/** Returns the query object. */
export const getQuery = (categoryId, query, maxResults) => {
    return {
        maxResults: maxResults,
        categoryId: categoryId,
        type: 'video',
        part: 'snippet',
        q: query
    }
}