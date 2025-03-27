import { TAGS_START_INDEX, INPUT_LENGTH } from './../config/constants.mjs';

/** Given an object holding collection of tags assigned to a
 * category,  and an array of tags, this function will assign
 *  an index to each tag in the array, if it is not already
 *  present in the collection.
 * 
 * @param {Object} tagsCollection - An object holding collection of tags assigned to a category
 * @param {Array} tags - An array of tags
 * @returns {Object} - An object holding collection of tags assigned to a category
 */
export const assignTagIndexes = (tagsCollection, tags) => {
    console.log(`Processing tags...`);

    // Initialise collection if the category is watched for the first time
    if (!tagsCollection) {
        tagsCollection = {};
    }

    if (Object.keys(tagsCollection).length > 0) {
        // Take the latest index entry
        let maxValue = Math.max(...Object.values(tagsCollection));

        for (let tag in tags) {
            // Check that the index will not be larger than the input space
            if (maxValue >= INPUT_LENGTH - 1) {
                console.log(`\nMaximum index reached...`);
                break;
            }

            if (!tagsCollection.hasOwnProperty(tags[tag])) {
                tagsCollection[tags[tag]] = ++maxValue;
            }
        }
    } else {
        let maxValue = TAGS_START_INDEX;

        tags.forEach(element => {
            tagsCollection[element] = ++maxValue;
        });
    }

    return tagsCollection;
}