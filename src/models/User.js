import mongoose from 'mongoose';

const ScoreSchema = new mongoose.Schema({
  deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck' }, 
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  answer: { type: String, required: true },
  correct: { type: Boolean, required: true },
  feedback: { type: String, required: true },
});

const UserSchema = new mongoose.Schema({
  discordId: { type: String, required: true },
  username: { type: String, required: true },
  studyDecks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Deck' }],
  scores: [ScoreSchema],
});

const User = mongoose.model('User', UserSchema);
export default User;