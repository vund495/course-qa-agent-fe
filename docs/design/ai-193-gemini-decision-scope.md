# Document upload validation changes

Implementation branch: `features/Implementation_SwitchToGeminiDecision1`.
Documentation branch: `features/Design_SwitchToGeminiDecision1`.

## Upload and retry behavior

The backend no longer calls an AI model to decide whether an uploaded document is relevant to its class. Class materials and syllabus unit materials therefore handle upload outcomes as accepted documents or errors. The frontend removes the relevance warning field from its upload result model, the relevance-specific warning helpers, and the dialogs that asked the user to force an upload or retry.

Existing file validation and upload errors remain visible. Accepted files are merged into the materials list and trigger the existing refresh notifications. Syllabus unit uploads retain their unit association. Older failed records continue to display their stored failure reason and use the normal retry action; they no longer need a special relevance confirmation.

The backend still accepts the legacy `force` argument for compatibility, but it does not bypass file validation, authorization, or syllabus requirements. Deploy the backend validation removal before the corresponding frontend change.

## Backend Decision flow

The backend uses `gemini-decision-1` for scope classification and an optional gate after Cross-Encoder reranking. The gate checks up to three high-scoring course chunks and removes a checked chunk when its support probability is at or below 0.10. It preserves the remaining reading order and fails open on timeout, provider error, or invalid response. It is disabled by default and does not run in the consented web lane.

These are backend responsibilities; this frontend change adds no gate controls or Decision calls. Query generation still uses a separate Flash Lite model. The experiment bypassing query generation has not been applied to application code. Complete gate configuration, evaluation reports, and the implementation plan are maintained in the backend repository on its corresponding Design branch.

## Verification

`npm test -- lib/documents.test.ts features/documents` passed all 55 tests across six files. Coverage includes upload results, refresh behavior, syllabus unit materials, and actions on existing failed records. React act warnings remain in the test output; no tests failed. The earlier implementation check `npx next typegen && npx tsc --noEmit` also passed.

The implementation commit contains the six changed frontend source/test files. This Design branch contains only this documentation change relative to its base.
