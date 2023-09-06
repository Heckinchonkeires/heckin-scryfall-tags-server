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

router.get('/random', async (req, res) => {
    const response = await fetch(
        `https://api.scryfall.com/cards/random?q=f%3Acommander`
        );
    const randomCard = await response.json();
    res.send(randomCard)
});

router.get('/random/:colors', async (req, res) => {
    const isValid = req.params.colors.toLowerCase().split('').every((char) => {
        return 'wubrgc'.indexOf(char) !== -1;
    });
    if (!isValid) {
        res.status(400).send("Invalid color string")
        return
    }
    const response = await fetch(
        `https://api.scryfall.com/cards/random?q=f%3Acommander%20commander%3A${req.params.colors}`
        );
    const randomCard = await response.json();
    res.send(randomCard)
});

router.get('/tags/:tags', async (req, res) => {
    const tagsArray = req.params.tags.split(' ');
    const queryString = buildTagQueryString(tagsArray)
    const response = await fetch(
        `https://api.scryfall.com/cards/search${queryString}`
    );
    const cardList = await response.json();
    res.send(cardList)
});

router.get('/:name', async (req, res) => {
    const response = await fetch(
        `https://api.scryfall.com/cards/named?fuzzy=${req.params.name}`
        );
    const card = await response.json();
    res.send(card);
});

router.get('/:set/:number', async (req, res) => {
    const card = await loadCardTags(req.params.set, req.params.number);

    if (!card) {
        res.status(400).send("No tags found")
        return
    }

    res.json(card);
});

function buildTagQueryString(tags) {
    let queryString = `?order=edhrec&q=otag:${tags[0]}`;

    if (tags.length === 1) {
        return queryString;
    };

    for (let i = 1; i < tags.length; i++) {
        queryString += `+or+otag:${tags[i]}`;
    };

    return queryString
};

async function loadCardTags(set, number) {
    const cards = await loadCardsCollection();
    const card = await cards.findOne({
        set: set, 
        number: number
    })

    if (!card) {
        const tags = await getScryfallTags(set, number);
        if (!tags.length) {
            return null
        }
        const newCard = {
            set: set,
            number: number,
            tags: tags,
            dateRetrieved: new Date()  
        }
        await cards.insertOne(newCard);
        return newCard;
    }
    return card
}

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

    let allTags = tags.concat(inheritedTags);

    allTags.sort();

    //removes the better than/worse than/referenced by/similar to bits
    allTags = allTags.filter((tag) => {
        return !tag.match(/^[A-Z]/g);
    })

    await browser.close();

    return allTags;
};

module.exports = router;