import mongoose from 'mongoose';

const DeckSchema = new mongoose.Schema({
  name: { type: String, required: true },  
  channelId: { type: String, required: true },  
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
});

const Deck = mongoose.model('Deck', DeckSchema);
export default Deck;
