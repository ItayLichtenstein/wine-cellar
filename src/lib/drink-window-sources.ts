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

// Where to look for a wine's label photo (the user's rule, 28 Nov 2026):
// Israeli shops first, since most bottles were bought here.
export const LABEL_SOURCES =
  "Finding a label photo: most bottles were bought in Israel, so Israeli wine shops (the wine's own product page) are usually the best place to start, " +
  "then other Israeli sites (the importer, the winery's Hebrew page), and then sites abroad (the winery itself, Vivino, foreign shops). " +
  "Before you send a link, take a look that the photo shows this bottle: the same winery and wine name on the label " +
  "(a winery often makes several wines with similar labels). If only another vintage is available, that is fine: say so with image_match. " +
  "A wine's own page works better than a search results page. If a site refuses the download, just try another source.";
