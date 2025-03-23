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

/** @constant {string} BACK_END_URL - URL of the backend API */
const BACK_END_URL = 'https://wruzvj4tp2.execute-api.eu-west-2.amazonaws.com';

/** @constant {number} INTERVAL_UPDATES - Interval at which the extension is collecting interaction data. */
const INTERVAL_UPDATES = 10000;

let interactions = {
    whileWatching: {}
};
let previouslyRecommended = {};
let selectedRecommendation = "";
let interactionInterval;

/** Handles the instructions received from the contant page. */
chrome.runtime.onConnect.addListener((port) => {
    console.log("Connected to content page...");
    port.onMessage.addListener(async (message) => {
        switch (message.update) {
            case UPDATES_TO_BACKGROUND.idChange:
                interactions.userId = message.userId;
                console.log("User watching a video...");

                // Interval to collect interaction data from content page
                startInterval(port);

                // Train the agent
                await startTraining(port);

                try {
                    let response = await getRecommendations();
                    processRecommendations(response, port);
                } catch (e) {
                    port.postMessage({
                        workerUpdate: WORKER_UPDATES.recommendationsError
                    })
                }

                break;
            case UPDATES_TO_BACKGROUND.getRecommendations:
                interactions.userId = message.userId;

                try {
                    let response = await getRecommendations();
                    processRecommendations(response, port);
                } catch (e) {
                    port.postMessage({
                        workerUpdate: WORKER_UPDATES.recommendationsError
                    })
                }

                break;
            case UPDATES_TO_BACKGROUND.getLowScoreVideos:
                console.log("Sending low scored videos to content page...")
                let videos = Object.values(previouslyRecommended.lowScoreVideos);

                if (videos.length > 0) {
                    port.postMessage({
                        workerUpdate: WORKER_UPDATES.showLowScoreVideos,
                        recommendations: videos
                    });
                } else {
                    port.postMessage({
                        workerUpdate: WORKER_UPDATES.lowScoreVideosError
                    });
                }

                break;
            case UPDATES_TO_BACKGROUND.intervalUpdate:

                // Check if the user liked, disliked, subscribed during this viewing session
                if (interactions.videoInteraction && message.interactions.hasLiked) {
                    if (!interactions.videoInteraction.hasLiked) {
                        interactions.whileWatching.hasLiked = true;
                        if (interactions.whileWatching.hasUnliked)
                            delete interactions.whileWatching.hasUnliked;
                    }
                }

                if (interactions.videoInteraction && !message.interactions.hasLiked) {
                    if (interactions.videoInteraction.hasLiked) {
                        interactions.whileWatching.hasUnliked = true;
                        if (interactions.whileWatching.hasLiked)
                            delete interactions.whileWatching.hasLiked;
                    }
                }

                if (interactions.videoInteraction && message.interactions.hasDisliked) {
                    if (!interactions.videoInteraction.hasDisliked) {
                        interactions.whileWatching.hasDisliked = true;
                        if (interactions.whileWatching.hasUnclickedDislike)
                            delete interactions.whileWatching.hasUnclickedDislike;
                    }
                }

                if (interactions.videoInteraction && !message.interactions.hasDisliked) {
                    if (interactions.videoInteraction.hasDisliked) {
                        interactions.whileWatching.hasUnclickedDislike = true;
                        if (interactions.whileWatching.hasDisliked)
                            delete interactions.whileWatching.hasDisliked;
                    }
                }

                if (interactions.videoInteraction && message.interactions.isSubscribed) {
                    if (!interactions.videoInteraction.isSubscribed) {
                        interactions.whileWatching.hasSubscribed = true;
                        if (interactions.whileWatching.hasUnsubscribed)
                            delete interactions.whileWatching.hasUnsubscribed;
                    }
                }

                if (interactions.videoInteraction && !message.interactions.isSubscribed) {
                    if (interactions.videoInteraction.isSubscribed) {
                        interactions.whileWatching.hasUnsubscribed = true;
                        if (interactions.whileWatching.hasSubscribed)
                            delete interactions.whileWatching.hasSubscribed;
                    }
                }

                // Update interactions, check if video received from WNN
                interactions.videoInteraction = message.interactions;
                interactions.videoInteraction.wasRecommended = (selectedRecommendation === message.interactions.videoId) ? true : false;

                break;
            case UPDATES_TO_BACKGROUND.wnnRecommendationSelected:
                selectedRecommendation = message.videoId;

                break;
            case UPDATES_TO_BACKGROUND.trainAgent:
                await startTraining(port);
                clearInterval(interactionInterval);

                break;
        }
    });
});

/** Initialises the interval for interactions check, clears the previous
 * if neccessary.
 * @param {Object} port - Port to communicate with the content page
 */
const startInterval = (port) => {
    if (interactionInterval)
        clearInterval(interactionInterval);

    interactionInterval = setInterval(() => {
        requestInteractions(port);
    }, INTERVAL_UPDATES);
}

/** Request interactions from the content page.
 * @param {Object} port - Port to communicate with the content page
 */
const requestInteractions = (port) => {
    port.postMessage({
        workerUpdate: WORKER_UPDATES.intervalCheck
    })
}

/** Initialises training process with collected data at the end of 
 * the viewing session.
 * @param {Object} port - Port to communicate with the content page
 */
const startTraining = async (port) => {
    // Train the agent with the previous YT data
    if (interactions.videoInteraction && interactions.videoInteraction.videoId) {
        let trainingResponse = await trainAgent();

        processTrainingResponse(trainingResponse, port);

        // Clear previous data after training
        delete interactions.videoInteraction;
        interactions.whileWatching = {};
    }
}

/** Train the agent with the video interactions collected. 
 * @returns {Promise<Object>} - Response from the backend API
*/
const trainAgent = async () => {
    console.log("Training agent...")
    let endpoint = '/train-agent';

    try {
        const response = await fetch(BACK_END_URL + endpoint, {
            method: "POST",
            body: JSON.stringify(interactions),
        });

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();

        console.log("Agent trained:\n", json);

        return json;
    } catch (error) {
        console.error(error.message);
    }
}

/** Request recommendations from the backend to be displayed back to the user.
 * @returns {Promise<Object>} - Response from the backend API
 */
const getRecommendations = async () => {
    console.log("Getting recommendations...")
    let endpoint = '/recommendations';

    let param = `?userId=${interactions.userId}`;

    try {
        const response = await fetch(BACK_END_URL + endpoint + param);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();

        return json;
    } catch (error) {
        console.error(error.message);
    }
}

/** Process the response from the backend API when training the agent.
 * @param {Object} response - Response from the backend API
 * @param {Object} port - Port to communicate with the content page
 */
const processTrainingResponse = (response, port) => {
    if (response.story) {
        console.log("Agent successfully trained...");

        port.postMessage({
            workerUpdate: WORKER_UPDATES.trainingConfirmation
        });
    } else {
        console.log("An error occurred when training the agent...");

        port.postMessage({
            workerUpdate: WORKER_UPDATES.trainingError
        });
    }
}

/** Process the response from the backend API when requesting 
 * recommendations.
 * @param {Object} response - Response from the backend API
 * @param {Object} port - Port to communicate with the content page
 */
const processRecommendations = (response, port) => {
    if (response) {
        if (response.needsMoreTraining) {
            console.log("User needs to watch more videos for training...");

            port.postMessage({
                workerUpdate: WORKER_UPDATES.recommendationsError,
                needsMoreTraining: true,
            });
        } else {
            if (response.toRecommend) {
                previouslyRecommended.toRecommend = response.toRecommend;
            }

            if (response.lowScoreVideos) {
                previouslyRecommended.lowScoreVideos = response.lowScoreVideos;
            }

            console.log("Sending recommendations to content page...");

            port.postMessage({
                workerUpdate: WORKER_UPDATES.showRecommendations,
                recommendations: Object.values(response.toRecommend)
            });
        }
    } else {
        console.log("Request was unsuccessful...");
        port.postMessage({
            workerUpdate: WORKER_UPDATES.recommendationsError
        });
    }
}