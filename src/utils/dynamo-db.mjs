import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    DeleteCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

/** To put an item into the relevant table.
 * @param {string} table - The name of the table to put the item into.
 * @param {Object} data - The data to be put into the table.
 * @returns {Promise<Object>} - A promise that resolves to the result of the put operation.
 */
export const putItem = async (table, data) =>
    await dynamo.send(
        new PutCommand({
            TableName: table,
            Item: data,
        })
    );

/** To retrieve an item from the relevant table.
 * @param {string} table - The name of the table to retrieve the item from.
 * @param {Object} parameters - The parameters to use for retrieving the item.
 * @returns {Promise<Object>} - A promise that resolves to the retrieved item.
 */
export const getItem = async (table, parameters) =>
    await dynamo.send(
        new GetCommand({
            TableName: table,
            Key: parameters
        })
    );

/** Query a table to get entries of a userId regardless of the sort
 * key.
 * @param {string} tableName - The name of the table to query.
 * @param {string} userId - The userId to query for.
 * @returns {Promise<Array>} - A promise that resolves to an array of items
 * matching the userId.
 */
export const getEntries = async (tableName, userId) => {
    const params = {
        TableName: tableName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
            ":userId": { S: userId } // Assuming userId is a string
        }
    };

    try {
        const data = await client.send(new QueryCommand(params));
        return data.Items; // Returns all items matching the userId
    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        throw error;
    }
}