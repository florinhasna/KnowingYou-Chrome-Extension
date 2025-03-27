import { INPUT_LENGTH, LANG_START_INDEX, CATEGORY_START_INDEX, LABEL_LENGTH } from './../config/constants.mjs';
import { getLanguageEncoding, handleBug } from './../utils/language-utility.mjs';
import { getCategoryEncoding } from './../utils/category-utility.mjs';
import { insertBinarySequence } from './../utils/utilities.mjs';

/** Create and populate an agent input array with given data.
 * @param {Object} videoData - The video data object.
 * @param {Object} tagIndexes - The tag indexes object.
 * @returns {Array} The generated input array.
 */
export const getInput = (videoData, tagIndexes) => {
    console.log(`Generating input...`);

    let input = new Array(INPUT_LENGTH);
    input.fill(0);

    if (videoData.language) {
        let language = handleBug(videoData.language);
        let langEncoding = getLanguageEncoding(language);
        console.log(`Language: ${language} - Encoding: ${langEncoding}`);
        insertBinarySequence(input, langEncoding, LANG_START_INDEX);
    }

    if (videoData.categoryId) {
        let categoryEncoding = getCategoryEncoding(videoData.categoryId);
        console.log(`Category ID: ${videoData.categoryId} - Encoding ${categoryEncoding}`);
        insertBinarySequence(input, categoryEncoding, CATEGORY_START_INDEX);
    }

    if (videoData.tags) {
        videoData.tags.forEach((tag) => {
            if (tagIndexes[tag] !== undefined && tagIndexes[tag] !== null) {
                console.log(`Tag: ${tag} - Index: ${tagIndexes[tag]}`);
                input[tagIndexes[tag]] = 1;
            }
        });
    }

    return input;
}

/** Create and populate a label array used for training an agent
 * according to the video interaction data.
 * @param {object} videoInteraction - The video interaction data
 * @returns {array} - The label array
 */
export const getLabel = (videoInteraction) => {
    console.log(`Generating label...`);

    let label = new Array(LABEL_LENGTH);
    label.fill(0);

    if (videoInteraction.hasLiked) {
        label.fill(1, 0, 4)
    } else if (videoInteraction.hasDisliked) {
        label.fill(0, 0, 4)
    } else {
        label.fill(1, 0, 2)
    }

    if (videoInteraction.isSubscribed) {
        label.fill(1, 4, 6)
    }

    let watchTimePercent = (videoInteraction.watchTime / videoInteraction.duration) * 100;

    if (watchTimePercent >= 90) {
        label.fill(1, 6, 10)
    } else if (watchTimePercent >= 75) {
        label.fill(1, 6, 9)
    } else if (watchTimePercent >= 50) {
        label.fill(1, 6, 8)
    } else if (watchTimePercent >= 25) {
        label.fill(1, 6, 7)
    }

    return label;
}