// Temporary in-memory data store for demo purposes
// This will be replaced with a proper database in production

export let tempUsers = [];

export const addUser = (user) => {
    tempUsers.push(user);
};

export const findUserByEmail = (email) => {
    return tempUsers.find(u => u.email === email);
};

export const findUserByUsername = (username) => {
    return tempUsers.find(u => u.username === username);
};

export const getAllUsersExcept = (excludeId) => {
    return tempUsers.filter(user => user._id !== excludeId);
};