// Where an AI should take a wine's drinking window from, best source first
// (the user's rule, 28 Nov 2026). One text for the MCP server and for the
// copy-paste request, so every AI gets the same order.

export const DRINK_WINDOW_SOURCES =
  "Drinking window: look it up for this exact wine and vintage in this order, and use the first source that gives one: " +
  "(1) critics and expert reviews (wine critics, magazines, competitions); (2) the winery itself (its site or tech sheet); " +
  "(3) wine shops; (4) anything else written about this wine on the web. " +
  "Only if none of these has it, estimate it from the grape, region, style and vintage compared with similar wines, and tell the user it is your estimate. " +
  "If even that is not enough, leave it empty (null) and say you found no information. " +
  "When you tell the user the window, say which kind of source it came from.";
