const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

let movieSchema = mongoose.Schema({
    Title: {type: String, required: true},
    Genre: {
        Name: String,
        Description: String
    },
    Director: {
        Name: String,
        Bio: String
    },
    Actors: [String],
    ImagePath: String,
    Featured: Boolean
});

let userSchema = mongoose.Schema({
    Username: {type: String, required: true},
    Password: {type: String, required: true},
    Email: {type: String, required: true},
    Birthday: {type: Date},
    FavoriteMovies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie'}]
});

// hash those passwords
userSchema.statics.hashPassword = (password) => {
    return bcryptjs.hashSync(password, 10);
};

// compare those hashed passwords
userSchema.methods.validatePassword = function(password) {
    return bcryptjs.compareSync(password, this.Password);
};

let Movie = mongoose.model('Movie', movieSchema);
let User = mongoose.model('User', userSchema);

module.exports.Movie = Movie;
module.exports.User = User;