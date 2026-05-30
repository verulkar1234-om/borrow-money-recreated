# Borrow Money Database

The backend supports MongoDB Atlas for deployed storage.

## Database

- Database name: `borrow_money`
- Collection name: `app_state`
- Main document id: `main`

## Main Document Shape

```json
{
  "_id": "main",
  "profile": {
    "shopName": "Example Shop",
    "ownerName": "Owner",
    "phoneNumber": "9876543210",
    "email": "shop@example.com",
    "createdAt": 1780000000000
  },
  "borrowings": [],
  "moneyEntries": []
}
```

## Render Environment Variables

Add these to your backend service:

```txt
CORS_ORIGIN=https://shopborrowingapp.netlify.app
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=borrow_money
```

If `MONGODB_URI` is not set, the backend uses local `data.json`.
