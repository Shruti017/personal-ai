import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  attachments: [{ name: String, mimeType: String, fileId: String }]
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  title: { type: String, default: "New conversation", maxlength: 160 },
  messages: [messageSchema]
}, { timestamps: true });

const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  mimeType: String,
  size: Number,
  status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
  extractedText: String,
  chunks: [{ text: String, locator: String }]
}, { timestamps: true });

const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  text: { type: String, required: true, maxlength: 3000 },
  category: { type: String, default: "General", maxlength: 60 },
  enabled: { type: Boolean, default: true },
  importance: { type: Number, min: 1, max: 5, default: 3 }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  title: { type: String, required: true, maxlength: 240 },
  description: { type: String, default: "", maxlength: 2000 },
  priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
  dueDate: Date,
  status: { type: String, enum: ["Todo", "In progress", "Done"], default: "Todo" }
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
export const Conversation = mongoose.model("Conversation", conversationSchema);
export const StoredFile = mongoose.model("StoredFile", fileSchema);
export const Memory = mongoose.model("Memory", memorySchema);
export const Task = mongoose.model("Task", taskSchema);


const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  runId: { type: String, index: true },
  type: { type: String, required: true, maxlength: 60 },
  message: { type: String, required: true, maxlength: 1000 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const approvalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  runId: { type: String, index: true },
  action: { type: String, enum: ["browser_navigate", "code_execute"], required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  result: { type: mongoose.Schema.Types.Mixed },
  completedAt: Date
}, { timestamps: true });

export const Activity = mongoose.model("Activity", activitySchema);
export const Approval = mongoose.model("Approval", approvalSchema);


const agentRunSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  runId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ["running", "awaiting_approval", "completed", "failed"], default: "running", index: true },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
  pendingToolCallId: String,
  answer: String,
  error: String
}, { timestamps: true });

export const AgentRun = mongoose.model("AgentRun", agentRunSchema);
