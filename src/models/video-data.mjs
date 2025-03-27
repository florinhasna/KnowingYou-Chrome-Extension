/** To extract only the required data of a video.
 * Checks if the video contains the required data.
 * @param {string} userId 
 * @param {string} videoId 
 * @param {object} videoData 
 * @returns {object}
 */
export const extractVideoData = (userId, videoId, videoData) => {
    let data = {
        userId: userId,
    }

    if(videoData.title) {
        data.title = videoData.title;
    }

    if(videoData.channelTitle) {
        data.channel = videoData.channelTitle;
    }

    if(videoData.tags) {
        data.tags = videoData.tags;
    }
    
    if(videoData.categoryId) {
        data.categoryId = videoData.categoryId;
    }

    if(videoData.defaultAudioLanguage) {
        data.language = videoData.defaultAudioLanguage;
    }

    if(videoData.defaultLanguage) {
        data.language = videoData.defaultLanguage;
    }

    if(videoData.thumbnails) {
        data.thumbnails = videoData.thumbnails;
    }

    return data;
}