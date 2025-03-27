import { processDataForTraining } from './data-service.mjs';
import { VIDEOS_TABLE, TAGS_TABLE } from './../config/constants.mjs';
import { putItem } from './../utils/dynamo-db.mjs';
import { train } from './../api/aolabs-api.mjs';

/** Initialises trainig of the agent, retrieves the processed data,
 * and calls the train function. Updates the videos and tags tables with the new data.
 * @param {string} userId - The user id.
 * @param {object} interactions - The interactions object.
 * @param {object} whileWatching - The whileWatching object.
 * @returns {object} - The training response.
 */
export const startTraining = async (userId, interactions, whileWatching) => {
    let { input, label, videoInteractions, previousAssignments } = await processDataForTraining(userId, interactions);

    let trainingResponse;

    if (input && label && previousAssignments) {
        trainingResponse = await train(userId, input, label);
    }

    if (trainingResponse && trainingResponse.story) {
        await putItem(VIDEOS_TABLE, {...videoInteractions, whileWatching});
        await putItem(TAGS_TABLE, previousAssignments);
    } else if (trainingResponse && trainingResponse.errorMessage) {
        console.log(trainingResponse);
        if (trainingResponse.errorMessage.includes('Task timed out')) {
            return {
                message: 'Training is taking longer than expected. Please try again later.',
                timeout: true,
                error: true
            };
        }
    } else {
        return {
            message: 'Training failed. Please try again later.',
            timeout: false,
            error: true
        };
    }
    return trainingResponse;
};