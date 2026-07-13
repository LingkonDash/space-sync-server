import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion, ObjectId, Collection } from "mongodb";
import { AuthedRequest, JwtUserPayload, Space, UserRole } from "./types";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";

dotenv.config();


const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

const PAGE_SIZE = 12;

if (!uri) throw new Error("Missing MONGODB_URI environment variable");
if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_BASE_URL environment variable");

console.log(baseUrl);


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



// ── JWKS + auth middleware ────────────────────────────────────────────────────
const JWKS = createRemoteJWKSet(new URL(`${baseUrl}/api/auth/jwks`), { timeoutDuration: 15000 });



const verifyToken = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];
        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload as unknown as JwtUserPayload;
        next();
    } catch (e) {
        console.error("JWT verification failed:");
        console.error(e);

        return res.status(403).json({
            message: "Forbidden",
            error: e instanceof Error ? e.message : e,
        });
    }
};

// ── Role guard — use AFTER verifyToken ───────────────────────────────────────
const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: AuthedRequest, res: Response, next: NextFunction) => {
        const role = req.user?.userRole as UserRole;
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ message: "Forbidden — insufficient role" });
        }
        next();
    };
};



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

        // ── GET /rooms/:id — single room detail (public) ───────────────────────────
        app.get("/rooms/:id", async (req: Request, res: Response) => {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid room id" });
            }

            const result = await roomsCollection.findOne({ _id: new ObjectId(id) } as any);

            if (!result) {
                return res.status(404).json({ message: "Room not found" });
            }

            res.json(result);
        });

        // ── POST /rooms — host/admin adds a new space (starts pending) ─────────────
        app.post("/rooms", verifyToken, requireRole("host", "admin"), async (req: AuthedRequest, res: Response) => {
            const roomData: Space = {
                ...req.body,
                status: "pending",
                rating: 0,
                reviewCount: 0,
                createdAt: new Date(),
            };

            const result = await roomsCollection.insertOne(roomData as any);
            res.json(result);
        });



        // ── PATCH /rooms/:id — host edits own room, or admin edits any ────────────
        app.patch("/rooms/:id", verifyToken, requireRole("host", "admin"), async (req: AuthedRequest, res: Response) => {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid room id" });
            }

            const room = await roomsCollection.findOne({ _id: new ObjectId(id) } as any);
            if (!room) {
                return res.status(404).json({ message: "Room not found" });
            }

            if (req.user?.role !== "admin" && room.hostEmail !== req.user?.email) {
                return res.status(403).json({ message: "You can only edit your own spaces" });
            }
            const updateData = { ...req.body };
            delete updateData._id;

            const result = await roomsCollection.updateOne(
                { _id: new ObjectId(id) } as any,
                { $set: updateData }
            );
            res.json(result);
        });

        // ── DELETE /rooms/:id — host deletes own room, or admin deletes any ────────
        app.delete("/rooms/:id", verifyToken, requireRole("host", "admin"), async (req: AuthedRequest, res: Response) => {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid room id" });
            }

            const room = await roomsCollection.findOne({ _id: new ObjectId(id) } as any);
            if (!room) {
                return res.status(404).json({ message: "Room not found" });
            }

            if (req.user?.role !== "admin" && room.hostEmail !== req.user?.email) {
                return res.status(403).json({ message: "You can only delete your own spaces" });
            }

            const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) } as any);
            res.json(result);
        });


        // ── GET /rooms/host/mine — host's own listings for Manage Spaces page ──────
        app.get("/rooms/host/mine", verifyToken, requireRole("host", "admin"), async (req: AuthedRequest, res: Response) => {
            const email = req.user?.email;
            const result = await roomsCollection.find({ hostEmail: email } as any).sort({ createdAt: -1 }).toArray();
            res.json(result);
        });
        
        app.get("/rooms/host/admin", verifyToken, requireRole("admin"), async (req: AuthedRequest, res: Response) => {
            const email = req.user?.email;
            const result = await roomsCollection.find().sort({ createdAt: -1 }).toArray();
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