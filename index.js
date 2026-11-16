import express from "express";
import { createApp } from "./server/src/app.js";

// Vercel serves this Express app as one function; static files come from /public.
export default createApp(express);
