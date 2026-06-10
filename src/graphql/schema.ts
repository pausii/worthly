// SDL GraphQL. Tiap operasi mengembalikan scalar JSON sehingga bentuk payload identik
// dengan respons REST lama. Input kompleks (create/update/import) diterima sebagai JSON.
export const typeDefs = /* GraphQL */ `
  scalar JSON

  # --- Tipe ber-field (sebagian operasi) agar bisa di-select satu per satu di GraphiQL.
  # Catatan: timestamp (ms) memakai Float karena melebihi rentang Int 32-bit GraphQL.
  type AuthStatus {
    needsSetup: Boolean
    authenticated: Boolean
  }
  type Me {
    username: String
    csrf: String
  }
  type Portfolio {
    id: Int
    name: String
    description: String
    sort_order: Int
    created_at: Float
    updated_at: Float
  }
  type ReturnsResult {
    currentValue: Float
    costBasis: Float
    abs: Float
    pct: Float
    pricedItems: Int
    totalItems: Int
    unpricedAssets: [String]
    earliestTs: Float
  }

  type Query {
    "GET /auth/status — { needsSetup, authenticated }"
    authStatus: AuthStatus
    "GET /auth/me — { username, csrf }"
    me: Me
    "GET /portfolios"
    portfolios: [Portfolio]
    "GET /accounts"
    accounts: JSON
    "GET /accounts/:id/balances"
    accountBalances(id: Int!): JSON
    "GET /holdings?portfolio_id="
    holdings(portfolioId: Int): JSON
    "GET /stocks"
    stocks: JSON
    "GET /dashboard/overview"
    overview: JSON
    "GET /dashboard/history"
    history(portfolioId: Int, days: String): JSON
    "GET /dashboard/asset-history"
    assetHistory(days: String): JSON
    "GET /dashboard/asset-chart"
    assetChart(symbol: String!, period: String): JSON
    "GET /dashboard/deposits"
    deposits(page: Int, limit: Int): JSON
    "GET /dashboard/returns"
    returns: ReturnsResult
    "GET /dashboard/insight"
    insight: JSON
    "GET /system/events"
    systemEvents(limit: Int): JSON
    "GET /system/queue"
    systemQueue: JSON
    "GET /export/{type}.csv — { filename, content }"
    exportCsv(type: String!): JSON
  }

  type Mutation {
    "POST /auth/setup"
    setup(username: String!, password: String!): JSON
    "POST /auth/login"
    login(username: String!, password: String!): JSON
    "POST /auth/logout"
    logout: JSON
    "POST /auth/change-password"
    changePassword(current: String!, next: String!): JSON

    "POST /portfolios"
    createPortfolio(input: JSON!): JSON
    "PUT /portfolios/:id"
    updatePortfolio(id: Int!, input: JSON!): JSON
    "DELETE /portfolios/:id"
    deletePortfolio(id: Int!): JSON

    "POST /accounts"
    createAccount(input: JSON!): JSON
    "PUT /accounts/:id"
    updateAccount(id: Int!, input: JSON!): JSON
    "DELETE /accounts/:id"
    deleteAccount(id: Int!): JSON
    "POST /accounts/:id/sync"
    syncAccount(id: Int!): JSON
    "POST /accounts/:id/backfill-deposits"
    backfillDeposits(id: Int!): JSON

    "POST /holdings"
    createHolding(input: JSON!): JSON
    "PUT /holdings/:id"
    updateHolding(id: Int!, input: JSON!): JSON
    "DELETE /holdings/:id"
    deleteHolding(id: Int!): JSON
    "POST /holdings/import"
    importHoldings(input: JSON!): JSON

    "POST /dashboard/sync"
    syncAll: JSON

    "POST /system/events/read-all"
    markEventsRead: JSON
    "DELETE /system/events"
    clearEvents: JSON
  }
`;
