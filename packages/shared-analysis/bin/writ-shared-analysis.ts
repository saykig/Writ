#!/usr/bin/env bun

import { SharedAnalysisError } from "../src/index.js";

throw new SharedAnalysisError(
  "SHARED_ANALYSIS_NOT_IMPLEMENTED",
  "The common recipient CLI is intentionally unimplemented on the comparison base.",
);
