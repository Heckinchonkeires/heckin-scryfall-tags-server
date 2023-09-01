const puppeteer = require("puppeteer");

async function getScryfallTags(set, number) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`https://tagger.scryfall.com/card/${set}/${number}`);

  const tags = await page.evaluate(() => {
    const tagTable = Array.from(
      document.querySelectorAll(
        "div.card-layout--tagging > section:last-child .taggings .tag-row span a"
      )
    );
    return tagTable.map((tagTable) => {
      return tagTable.innerHTML;
    });
  });

  const inheritedTags = await page.evaluate(() => {
    const tagList = Array.from(
      document.querySelectorAll(
        "div.card-layout--tagging > section:last-child div.tagging-ancestors a"
      )
    );
    return tagList.map((tag) => {
      return tag.innerHTML;
    });
  });

  const allTags = tags.concat(inheritedTags);

  allTags.sort();

  await browser.close();



  return allTags;
}

if (require.main === module) {
    getScryfallTags("bbd", 629).then((tags) => {
        console.log(!tags.length);
    });
}

exports.getScryfallTags = getScryfallTags;
