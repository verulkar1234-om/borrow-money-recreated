const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const dataFile = path.join(root, "data.json");
const port = process.env.PORT || 5601;
const allowedOrigin = process.env.CORS_ORIGIN || "*";
const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || "borrow_money";
const appStateId = "main";

let mongoClient = null;
let mongoCollection = null;

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json"
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultData() {
  const today = new Date().toISOString().slice(0, 10);

  return {
    profile: null,
    borrowings: [
      {
        id: createId(),
        customerName: "Ravi Kumar",
        phoneNumber: "9876543210",
        itemName: "Rice bag",
        quantity: 1,
        amount: 1250,
        dueDate: today,
        notes: "Regular customer",
        returned: false,
        createdAt: Date.now()
      }
    ],
    moneyEntries: [
      {
        id: createId(),
        type: "credit",
        amount: 500,
        entryDate: today,
        reason: "Opening cash",
        notes: "Demo money entry",
        createdAt: Date.now()
      }
    ]
  };
}

async function connectDatabase() {
  if (!mongoUri || mongoCollection) return mongoCollection;

  const { MongoClient } = require("mongodb");
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoCollection = mongoClient.db(mongoDbName).collection("app_state");
  await mongoCollection.updateOne(
    { _id: appStateId },
    { $setOnInsert: { ...defaultData(), _id: appStateId } },
    { upsert: true }
  );
  return mongoCollection;
}

async function readData() {
  if (mongoUri) {
    const collection = await connectDatabase();
    const data = await collection.findOne({ _id: appStateId });
    return normalizeData(data || defaultData());
  }

  if (!fs.existsSync(dataFile)) {
    const data = defaultData();
    await writeData(data);
    return data;
  }

  try {
    return normalizeData(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  } catch {
    return defaultData();
  }
}

async function writeData(data) {
  const normalized = normalizeData(data);

  if (mongoUri) {
    const collection = await connectDatabase();
    await collection.updateOne(
      { _id: appStateId },
      { $set: { ...normalized, _id: appStateId } },
      { upsert: true }
    );
    return;
  }

  fs.writeFileSync(dataFile, JSON.stringify(normalized, null, 2));
}

function normalizeData(data) {
  return {
    profile: data.profile || null,
    borrowings: Array.isArray(data.borrowings) ? data.borrowings : [],
    moneyEntries: Array.isArray(data.moneyEntries) ? data.moneyEntries : []
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = path.resolve(root, requestPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "text/plain" });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const data = await readData();
  const method = req.method;
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, data);
      return;
    }

    if (method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, app: "Borrow Money" });
      return;
    }

    if (method === "POST" && url.pathname === "/api/profile") {
      const body = await readBody(req);
      data.profile = {
        shopName: String(body.shopName || "").trim(),
        ownerName: String(body.ownerName || "").trim(),
        phoneNumber: String(body.phoneNumber || "").trim(),
        email: String(body.email || "").trim(),
        createdAt: Date.now()
      };
      await writeData(data);
      sendJson(res, 201, data.profile);
      return;
    }

    if (method === "DELETE" && url.pathname === "/api/profile") {
      data.profile = null;
      await writeData(data);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && url.pathname === "/api/borrowings") {
      sendJson(res, 200, data.borrowings);
      return;
    }

    if (method === "POST" && url.pathname === "/api/borrowings") {
      const body = await readBody(req);
      const entry = {
        id: createId(),
        customerName: String(body.customerName || "").trim(),
        phoneNumber: String(body.phoneNumber || "").trim(),
        itemName: String(body.itemName || "").trim(),
        quantity: Number(body.quantity || 1),
        amount: Number(body.amount || 0),
        dueDate: String(body.dueDate || ""),
        notes: String(body.notes || "").trim(),
        returned: false,
        createdAt: Date.now()
      };

      data.borrowings.push(entry);
      await writeData(data);
      sendJson(res, 201, entry);
      return;
    }

    if (method === "PATCH" && parts[0] === "api" && parts[1] === "borrowings" && parts[3] === "toggle") {
      const id = parts[2];
      const entry = data.borrowings.find((item) => item.id === id);
      if (!entry) {
        sendJson(res, 404, { error: "Borrow entry not found" });
        return;
      }

      entry.returned = !entry.returned;
      await writeData(data);
      sendJson(res, 200, entry);
      return;
    }

    if (method === "DELETE" && parts[0] === "api" && parts[1] === "borrowings" && parts[2]) {
      data.borrowings = data.borrowings.filter((entry) => entry.id !== parts[2]);
      await writeData(data);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && url.pathname === "/api/money") {
      sendJson(res, 200, data.moneyEntries);
      return;
    }

    if (method === "POST" && url.pathname === "/api/money") {
      const body = await readBody(req);
      const entry = {
        id: createId(),
        type: body.type === "debit" ? "debit" : "credit",
        amount: Number(body.amount || 0),
        entryDate: String(body.entryDate || ""),
        reason: String(body.reason || "").trim(),
        notes: String(body.notes || "").trim(),
        createdAt: Date.now()
      };

      data.moneyEntries.push(entry);
      await writeData(data);
      sendJson(res, 201, entry);
      return;
    }

    if (method === "DELETE" && parts[0] === "api" && parts[1] === "money" && parts[2]) {
      data.moneyEntries = data.moneyEntries.filter((entry) => entry.id !== parts[2]);
      await writeData(data);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "DELETE" && url.pathname === "/api/all") {
      data.borrowings = [];
      data.moneyEntries = [];
      await writeData(data);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  })
  .listen(port, () => {
    console.log(`Borrow Money backend running on port ${port}`);
  });
