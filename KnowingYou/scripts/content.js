const PORT = chrome.runtime.connect({ name: "commChannel" });

/** @constant {Object} WORKER_UPDATES - Update instructions from background.js */
const WORKER_UPDATES = {
    showRecommendations: 'load_recommendations',
    recommendationsError: 'recommendations_error',
    trainingConfirmation: 'training_confirmation',
    trainingError: 'training_error',
    showLowScoreVideos: 'load_low_score_videos',
    lowScoreVideosError: 'low_score_error',
    intervalCheck: 'check_interactions'
}

/** @constant {Object} UPDATES_TO_BACKGROUND - Update instructions to background.js */
const UPDATES_TO_BACKGROUND = {
    idChange: 'videoId_change',
    getRecommendations: 'get_recommendations',
    getLowScoreVideos: 'get_low_score_videos',
    intervalUpdate: 'interval_update',
    wnnRecommendationSelected: 'recommendation_selected',
    trainAgent: 'start_training'
}

/** @constant {Object} ELEMENT_IDS - IDs of elements to be created or existent required. */
const ELEMENT_IDS = {
    homepageElement: 'contents',
    watchElement: 'related',
    recommendationsWrapper: 'wnnWrapper',
    recommendationsContainer: 'wnnContainer',
    loading: 'loadingMessage',
    lowScoreButton: 'lowScoreButton',
    messageContainer: 'kyMessageContainer'
}

/** @constant {string} MAIN_HEADER - Header of the container, name of recommender. */
const MAIN_HEADER = "KnowingYou";

/** @constant {Object} MESSAGES - Messages to be displayed at any point. */
const MESSAGES = {
    insufficientTraining: {
        message: "Not enough data for recommendations, please watch some videos so the agent can learn about your preferences...",
        type: "ky-info"
    },
    recommendationsError: {
        message: "Something went wrong retrieving recommendations, please continue watching...",
        type: "ky-error"
    },
    noRecommendations: {
        message: "No videos to recommend this time, the videos have received a low score...",
        type: "ky-error"
    },
    successfulTraining: {
        message: "Agent trained successfully...",
        type: "ky-success"
    },
    trainingError: {
        message: "Something went wrong when training the agent...",
        type: "ky-error"
    },
    noLowRecommendations: {
        message: "No low score videos this time...",
        type: "ky-success"
    }
}

/** @constant {string} LOCAL_STORAGE_ID - Reference to the item stored in local storage. */
const LOCAL_STORAGE_ID = 'userId';

let lastVideoId = null;
let url;
let requiresRecommendations = true;

/** Observer that identifies URL changes, user's navigation.
 * Initialises userId for new users, and starts the process of
 * training, recommending, injecting on DOM as required.
 */
const observer = new MutationObserver(async () => {
    // Setting up a user id if there isn't one...
    if (!localStorage.getItem(LOCAL_STORAGE_ID)) {
        localStorage.setItem(LOCAL_STORAGE_ID, generateUniqueId())
    }

    url = location.href;

    // Checks if the container is created and if is hidden
    removeHiddenClass();

    // Check if the user is watching something
    if (url.includes('/watch')) {
        const currentVideoId = getParameter(url, 'v');

        // Check if the videoId changed
        if (currentVideoId && currentVideoId !== lastVideoId) {
            lastVideoId = currentVideoId;

            // Injects main container into the page
            checkWrapperExistance(ELEMENT_IDS.watchElement);

            // Ping the worker
            PORT.postMessage({
                update: UPDATES_TO_BACKGROUND.idChange,
                userId: localStorage.getItem(LOCAL_STORAGE_ID)
            });

            // To load recommendations next time user navigates to homepage
            requiresRecommendations = true;
        }
    } else if (url === 'https://www.youtube.com/') {
        let recommendationsWrapper = document.getElementById(ELEMENT_IDS.recommendationsWrapper);
        let watchContainer = document.getElementById(ELEMENT_IDS.watchElement);

        if (requiresRecommendations || !recommendationsWrapper || watchContainer.contains(recommendationsWrapper)) {
            checkWrapperExistance(ELEMENT_IDS.homepageElement);

            if (recommendationsWrapper) {
                PORT.postMessage({
                    update: UPDATES_TO_BACKGROUND.getRecommendations,
                    userId: localStorage.getItem(LOCAL_STORAGE_ID)
                });

                // Recommendations for homepage
                requiresRecommendations = false;

                PORT.postMessage({
                    update: UPDATES_TO_BACKGROUND.trainAgent
                });
            }
        }
    }
});

observer.observe(document, { subtree: true, childList: true });

/** Returns the time in miliseconds, used as userId.
 * @returns {number} The current timestamp.
 */
const generateUniqueId = () => {
    return Date.now();
}

/** Retrieves a parameter of the URL, used to get videoId.
 * @param {string} url - The URL to be parsed.
 * @param {string} param - The parameter to be retrieved.
 * @returns {string} The value of the parameter.
 */
const getParameter = (url, param) => {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get(param);
}

/** Checks if the recommendations wrapper exists, if so deletes it to avoid duplicates.
 * @param {string} elementId - The ID of the element to be appended on.
 */
const checkWrapperExistance = (elementId) => {
    let container = document.getElementById(ELEMENT_IDS.recommendationsWrapper);

    if (container) {
        container.remove();
    }

    initialiseContainer(elementId);
}

/** Function that extract the interactions of a user with the video, called by background
 * through an interval and pings background with data.
 */
const checkInteractions = () => {
    let subscribeButtons = document.getElementById('subscribe-button').querySelectorAll('button')

    let likeButton = document.querySelector('button[title="I like this"]') || document.querySelector('button[title="Unlike"]');
    let dislikeButton = document.querySelector('button[aria-label="Dislike this video"]');

    // To make sure the data is collected when elements are loaded
    if (likeButton && dislikeButton) {
        PORT.postMessage({
            update: UPDATES_TO_BACKGROUND.intervalUpdate,
            interactions: {
                hasLiked: likeButton.ariaPressed.includes('true'),
                hasDisliked: dislikeButton.ariaPressed.includes('true'),
                isSubscribed: subscribeButtons[0].ariaLabel.includes('Unsubscribe'),
                watchTime: document.querySelector('video').currentTime,
                duration: document.querySelector('video').duration,
                videoId: lastVideoId
            }
        })
    }
}

/** Check and remove the automatically generated hidden class when YouTube DOM renders
 * when browsing videos. 
 */
const removeHiddenClass = () => {
    let container = document.getElementById(ELEMENT_IDS.recommendationsWrapper);
    if (container && container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        document.getElementById(ELEMENT_IDS.watchElement).prepend(container);
    }
}

/** Creates a container to display recommendations, appends to a
 * YouTube element.
 * @param {string} elementId - The ID of the element to be appended on.
 */
const initialiseContainer = (elementId) => {
    let youTubeElement = getYouTubeElement(elementId);

    if (!youTubeElement)
        return;

    let container = getRecommendationContainer();
    container.appendChild(getHeader(MAIN_HEADER));

    let grid = getGrid();
    container.appendChild(grid);

    grid.appendChild(getLoadingMessage());

    youTubeElement.prepend(container);
}

/** Retrieving an YouTube element based on ID, a recurrsion to avoid
 * errors when checking too soon, before the page is fully loaded.
 * @param {string} elementId - The ID of the element to be retrieved.
 * @returns {HTMLElement} The retrieved element.
 */
const getYouTubeElement = (elementId) => {
    let youTubeElement = document.getElementById(elementId);

    // Handle a bug when injecting
    if (elementId === ELEMENT_IDS.homepageElement) {
        youTubeElement = document.querySelector("div#contents.style-scope.ytd-rich-grid-renderer");
    }

    if (youTubeElement) {
        return youTubeElement;
    } else {
        // Retry after 1000ms if the element doesn't exist yet
        setTimeout(() => getYouTubeElement(elementId), 1000);
    }
}

/** Initialises a container for recommendations.
 * @returns {HTMLElement} The created container.
 */
const getRecommendationContainer = () => {
    const container = document.createElement("div");
    container.className = "ky-main-container";
    container.id = ELEMENT_IDS.recommendationsWrapper;

    return container;
}

/** Initialises a header element.
 * @returns {HTMLElement} The created heaeder.
 */
const getHeader = (text) => {
    const header = document.createElement("span");
    header.className = 'ky-header';
    header.innerHTML = text;

    return header;
}

/** Creates another element, to store elements in columns when needed.
 * @param {string} elementId - The ID of the element to be appended on.
 * @returns {HTMLElement} The created grid.
 */
const getGrid = () => {
    const grid = document.createElement("div");
    grid.className = "ky-grid";
    grid.id = ELEMENT_IDS.recommendationsContainer;

    return grid;
}

/** Creates a loading message with a spinner.#
 * @returns {HTMLElement} The created loading message.
 */
const getLoadingMessage = () => {
    const container = document.createElement("div");
    container.className = "ky-grid-item";
    container.id = ELEMENT_IDS.loading;

    const text = document.createElement("p");
    text.className = "ky-loading-text"
    text.textContent = "Loading recommendations...";

    const spinner = document.createElement("div");
    spinner.className = "ky-spinner"

    container.appendChild(spinner);
    container.appendChild(text);

    return container;
}

/** Handler for message instructions received from the service_worker. */
PORT.onMessage.addListener((message) => {
    switch (message.workerUpdate) {
        case WORKER_UPDATES.showRecommendations:
            clearElement(ELEMENT_IDS.recommendationsContainer);

            if (message.recommendations.length === 0) {
                displayMessage(MESSAGES.noRecommendations, ELEMENT_IDS.recommendationsWrapper);
            } else {
                loadRecommendations(message.recommendations);
            }

            // Append a button to display low score videos if there isn't one
            if (!document.getElementById(ELEMENT_IDS.lowScoreButton)) {
                document.getElementById(ELEMENT_IDS.recommendationsWrapper).appendChild(getLowScoreButton());
            }

            break;
        case WORKER_UPDATES.recommendationsError:
            clearElement(ELEMENT_IDS.recommendationsContainer);

            if (message.needsMoreTraining) {
                displayMessage(MESSAGES.insufficientTraining, ELEMENT_IDS.recommendationsWrapper);
            } else {
                displayMessage(MESSAGES.recommendationsError, ELEMENT_IDS.recommendationsWrapper);
            }

            break;
        case WORKER_UPDATES.showLowScoreVideos:

            document.getElementById(ELEMENT_IDS.lowScoreButton).remove();

            if (message.recommendations.length === 0) {
                displayMessage(MESSAGES.noLowRecommendations, ELEMENT_IDS.recommendationsWrapper);
            } else {
                loadRecommendations(message.recommendations);
            }

            break;
        case WORKER_UPDATES.lowScoreVideosError:
            displayMessage(MESSAGES.lowScoreError, ELEMENT_IDS.recommendationsWrapper);
            document.getElementById(ELEMENT_IDS.lowScoreButton).remove();

            break;
        case WORKER_UPDATES.trainingConfirmation:
            displayMessage(MESSAGES.successfulTraining, ELEMENT_IDS.recommendationsWrapper);

            break;
        case WORKER_UPDATES.trainingError:
            displayMessage(MESSAGES.trainingError, ELEMENT_IDS.recommendationsWrapper);

            break;
        case WORKER_UPDATES.intervalCheck:
            checkInteractions();

            break;
    }
});

/** Clears the element of the given ID of all its children nodes.
 * @param {string} elementId - The ID of the element to be cleared.
*/
const clearElement = (elementId) => {
    let element = document.getElementById(elementId);

    if (!element)
        return;

    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/** Creates and appends a message to be displayed to the user.
 * @param {Object} info - The message information.
 * @param {string} elementId - The ID of the element to be appended on.
 */
const displayMessage = (info, elementId) => {
    let container = document.getElementById(elementId);

    if (!container)
        return;

    const messageContainer = document.createElement("div");
    messageContainer.id = ELEMENT_IDS.messageContainer;
    messageContainer.className = `ky-message-wrapper ${info.type}`;

    const messageText = document.createElement("p");
    messageText.textContent = info.message;

    messageContainer.appendChild(messageText);

    container.appendChild(messageContainer);
}

/** Loads the recommendations into the page.
 * @param {Object[]} recommendations - The recommendations to be loaded.
 * @param {string} elementId - The ID of the element to be appended on.
 */
const loadRecommendations = (recommendations) => {
    let container = document.getElementById(ELEMENT_IDS.recommendationsContainer);

    if (!container)
        return;

    let messageContainer = document.getElementById(ELEMENT_IDS.messageContainer);

    if (messageContainer) {
        messageContainer.remove();
    }

    for (let recommendation of recommendations) {
        let videoContainer = getVideoContainer(recommendation);

        if (videoContainer === null) {
            continue;
        }

        container.appendChild(videoContainer);
    }
}

/** Creates and return a video container to be displayed to the user.
 * @param {Object} video - The video to be displayed.
 * @returns {HTMLElement} The created video container.
 */
const getVideoContainer = (video) => {
    const col = document.createElement("div");
    col.style.cursor = "pointer";
    col.className = "ky-grid-item";

    let thumbnail = document.createElement("img");

    // The video must have thumbnails to be displayed
    if (!video.thumbnails) {
        return null;
    }

    if (video.thumbnails.maxres && video.thumbnails.maxres.url) {
        thumbnail.src = video.thumbnails.maxres.url;
    } else if (video.thumbnails.standard && video.thumbnails.standard.url) {
        thumbnail.src = video.thumbnails.standard.url;
    } else if (video.thumbnails.high && video.thumbnails.high.url) {
        thumbnail.src = video.thumbnails.high.url;
    } else if (video.thumbnails.medium && video.thumbnails.medium.url) {
        thumbnail.src = video.thumbnails.medium.url;
    } else if (video.thumbnails.default && video.thumbnails.default.url) {
        thumbnail.src = video.thumbnails.default.url;
    } else {
        return null;
    }

    thumbnail.style.width = "100%";
    thumbnail.style.borderRadius = "8px";

    // Create title
    let titleElement = document.createElement("p");
    titleElement.className = "ky-video-text"
    titleElement.textContent = video.title;

    // Create title
    let channelElement = document.createElement("p");
    channelElement.className = "ky-video-text ky-video-channel"
    channelElement.textContent = video.channel;


    // Append elements
    col.appendChild(thumbnail);
    col.appendChild(titleElement);
    col.appendChild(channelElement);

    col.appendChild(getScoreContainer(video.score))

    // On click, change URL like YouTube
    col.addEventListener("click", function () {
        PORT.postMessage({
            update: UPDATES_TO_BACKGROUND.wnnRecommendationSelected,
            videoId: video.videoId
        });

        window.location.href = `/watch?v=${video.videoId}`;
    });

    return col;
}

/** Creates a button with a specific colour to serve as a indication
 * towards the score determined by the agent.
 * @param {number} score - The score of the video.
 * @returns {HTMLElement} The created button.
 */
const getScoreContainer = (score) => {
    const container = document.createElement("div");

    if (score >= 50)
        container.className = "ky-score ky-success";
    else
        container.className = "ky-score ky-error";

    const text = document.createElement('p');
    text.innerHTML = score;

    container.appendChild(text)

    return container;
}

/** Creates and returns a button to display low scored videos
 * at the choice of the user.
 * @returns {HTMLElement} The created button.
 */
const getLowScoreButton = () => {
    const button = document.createElement('button');
    button.className = "ky-button";
    button.type = "button";
    button.innerHTML = "Display low score videos";
    button.onclick = requestLowScoreVideos;
    button.id = ELEMENT_IDS.lowScoreButton;

    return button;
}

/** Send instruction to the worker the get the low scored videos. */
const requestLowScoreVideos = () => {
    PORT.postMessage({
        update: UPDATES_TO_BACKGROUND.getLowScoreVideos
    });
}