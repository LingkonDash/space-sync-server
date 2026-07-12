import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion, ObjectId, Collection } from "mongodb";
import { Space } from "./types";

dotenv.config();


const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

const PAGE_SIZE = 12;

if (!uri) throw new Error("Missing MONGODB_URI environment variable");
if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_BASE_URL environment variable");



app.use(cors());
app.use(express.json());

// ── Mongo client ─────────────────────────────────────────────────────────────
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});



// ── Mongo run() function ──────────────────────────────────────────────────────
async function run() {
    try {
        await client.connect();

        const db = client.db("spaceSync");
        const roomsCollection: Collection<Space> = db.collection("rooms");

        // ── GET /rooms — search/filter/sort/paginate (public, only approved) ──────
        app.get("/rooms", async (req: Request, res: Response) => {
            const {
                search,
                category,
                city,
                minPrice,
                maxPrice,
                minCapacity,
                sort,
                page,
            } = req.query as Record<string, string | undefined>;

            const query: Record<string, unknown> = { status: "approved" };

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { location: { $regex: search, $options: "i" } },
                    { city: { $regex: search, $options: "i" } },
                ];
            }
            if (category) query.category = category;
            if (city) query.city = city;

            if (minPrice || maxPrice) {
                const priceFilter: Record<string, number> = {};
                if (minPrice) priceFilter.$gte = Number(minPrice);
                if (maxPrice) priceFilter.$lte = Number(maxPrice);
                query.pricePerHour = priceFilter;
            }

            if (minCapacity) {
                query.capacity = { $gte: Number(minCapacity) };
            }

            let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
            if (sort === "price-asc") sortOption = { pricePerHour: 1 };
            else if (sort === "price-desc") sortOption = { pricePerHour: -1 };
            else if (sort === "rating") sortOption = { rating: -1 };

            const currentPage = Number(page) || 1;
            const skip = (currentPage - 1) * PAGE_SIZE;

            const result = await roomsCollection
                .find(query)
                .sort(sortOption)
                .skip(skip)
                .limit(PAGE_SIZE)
                .toArray();

            res.json(result);
        });

        // ── GET /rooms/featured — top-rated approved rooms for Home page ──────────
        app.get("/rooms/featured", async (req: Request, res: Response) => {
            const limit = Number(req.query.limit) || 8;

            const result = await roomsCollection
                .find({ status: "approved" })
                .sort({ rating: -1 })
                .limit(limit)
                .toArray();

            res.json(result);
        });


    } finally {
        // await client.close();
    }
}

run();

app.get("/", (req: Request, res: Response) => {
    res.send("SpaceSync server is running fine!");
});

app.listen(port, () => {
    console.log("Server is running on port", port);
});