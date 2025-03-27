import { getQuery } from "./../models/query-model.mjs";
import { searchVideos } from "./../api/youtube-data-api.mjs";
import { getRandomIndex, removeDuplicatesByVideoId } from "./../utils/utilities.mjs";
import { MAX_RESULTS, VIDEOS_TO_RETURN } from "./../config/constants.mjs";
import { unmarshall } from "@aws-sdk/util-dynamodb";

/** Searches for videos and adds them to an array.
 * @param {Array} categories - An array of categories.
 * @returns {Object} An object containing the search results and tags by category.
 */
export const searchVideosToRecommend = async (categories) => {
    let searchResults = [];
    let tagsByCategory = {};

    while (categories.length > 0 && searchResults.length < VIDEOS_TO_RETURN) {
        let categoryCollection = categories[getRandomIndex(0, categories.length - 1)];
        // Convert the DynamoDB JSON format to tradition JSON format.
        categoryCollection = unmarshall(categoryCollection);

        let categoryId = categoryCollection.categoryId;

        let tags = Object.keys(categoryCollection.tagAssignments);

        let keyword = tags[getRandomIndex(0, tags.length - 1)];

        let queryParameter = getQuery(categoryId, keyword, MAX_RESULTS);

        let videos = await searchVideos(queryParameter);

        if (videos.items && videos.items.length > 0) {
            searchResults = searchResults.concat(videos.items);
            tagsByCategory[categoryId] = categoryCollection.tagAssignments;
        }

        if(searchResults.length > 0) {
            searchResults = removeDuplicatesByVideoId(searchResults);
        }
    }

    return { searchResults, tagsByCategory };
}