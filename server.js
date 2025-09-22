import express from "express";
import { run as runVSDT } from "./VSDT.js";

const app = express();
app.use(express.json());
