const express = require('express');
const mongodb = require('mongodb');
const puppeteer = require("puppeteer");
const DATABASE_URI = require('../../../dburi')

const router = express.Router();

router.get('/', async (req, res) => {
    const cards = await loadCardsCollection();
    const cardCount = await cards.countDocuments({});
    res.send(`There are ${cardCount} card(s) in the database`);
});

router.get('/:set/:number', async (req, res) => {
    const cards = await loadCardsCollection();
    const card = await cards.findOne({ 
        set: req.params.set, 
        number: req.params.number
    });

    if (!card) {
        const tags = await getScryfallTags(req.params.set, req.params.number);
        if (!tags.length) {
            res.status(400).send("No tags found")
            return
        }
        await cards.insertOne({
            set: req.params.set,
            number: req.params.number,
            tags: tags,
            dateRetrieved: new Date()
        });
        res.status(201).send("Created new card")
        return
    }

    res.json(card)
});

async function loadCardsCollection() {  
    const client = await mongodb.MongoClient.connect(
        process.env.MONGODB_URI || DATABASE_URI.uri
    )

    return client.db('heckinScryfallTags').collection('cards');
};

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
};

module.exports = router;