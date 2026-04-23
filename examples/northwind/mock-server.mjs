// Tiny local mock of the Northwind V4 service.
// Serves enough to smoke-test the MCP proxy against realistic V4 response shapes.
// Run with: node examples/northwind/mock-server.mjs

import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4005);

const customers = [
  { CustomerID: 'ALFKI', CompanyName: 'Alfreds Futterkiste', ContactName: 'Maria Anders', City: 'Berlin',     Country: 'Germany', Phone: '030-0074321' },
  { CustomerID: 'ANATR', CompanyName: 'Ana Trujillo Emparedados y helados', ContactName: 'Ana Trujillo', City: 'México D.F.', Country: 'Mexico',  Phone: '(5) 555-4729' },
  { CustomerID: 'ANTON', CompanyName: 'Antonio Moreno Taquería', ContactName: 'Antonio Moreno', City: 'México D.F.', Country: 'Mexico',  Phone: '(5) 555-3932' },
  { CustomerID: 'AROUT', CompanyName: 'Around the Horn',   ContactName: 'Thomas Hardy', City: 'London',     Country: 'UK',      Phone: '(171) 555-7788' },
  { CustomerID: 'BERGS', CompanyName: 'Berglunds snabbköp', ContactName: 'Christina Berglund', City: 'Luleå', Country: 'Sweden', Phone: '0921-12 34 65' },
];

const products = [
  { ProductID: 1, ProductName: 'Chai',                       CategoryID: 1, SupplierID: 1, UnitPrice: 18.0, UnitsInStock: 39, Discontinued: false },
  { ProductID: 2, ProductName: 'Chang',                      CategoryID: 1, SupplierID: 1, UnitPrice: 19.0, UnitsInStock: 17, Discontinued: false },
  { ProductID: 3, ProductName: 'Aniseed Syrup',              CategoryID: 2, SupplierID: 1, UnitPrice: 10.0, UnitsInStock: 13, Discontinued: false },
  { ProductID: 4, ProductName: "Chef Anton's Cajun Seasoning", CategoryID: 2, SupplierID: 2, UnitPrice: 22.0, UnitsInStock: 53, Discontinued: false },
];

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

function applyV4Query(all, query, context) {
  let data = [...all];

  // $filter — just support `X eq 'Y'` or `X eq 42` for the smoke test
  const filter = query.$filter;
  if (filter) {
    const m = filter.match(/^\s*(\w+)\s+eq\s+(?:'([^']*)'|(-?\d+(?:\.\d+)?))\s*$/);
    if (m) {
      const field = m[1];
      const val = m[2] !== undefined ? m[2] : Number(m[3]);
      data = data.filter((r) => r[field] === val);
    }
  }

  const totalCount = data.length;

  if (query.$skip) data = data.slice(Number(query.$skip));
  if (query.$top) data = data.slice(0, Number(query.$top));

  if (query.$select) {
    const fields = query.$select.split(',').map((s) => s.trim());
    data = data.map((r) => Object.fromEntries(fields.filter((f) => f in r).map((f) => [f, r[f]])));
  }

  const body = {
    '@odata.context': `$metadata#${context}`,
    value: data,
  };
  if (query.$count === 'true') body['@odata.count'] = totalCount;
  return body;
}

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  const query = parseQuery(url);
  const pathOnly = url.split('?')[0];

  res.setHeader('Content-Type', 'application/json');

  if (pathOnly === '/V4/Northwind/Northwind.svc/Customers') {
    res.writeHead(200);
    res.end(JSON.stringify(applyV4Query(customers, query, 'Customers')));
    return;
  }
  if (pathOnly === '/V4/Northwind/Northwind.svc/Products') {
    res.writeHead(200);
    res.end(JSON.stringify(applyV4Query(products, query, 'Products')));
    return;
  }
  // Single-entity by key: Customers('ALFKI')
  const m = pathOnly.match(/^\/V4\/Northwind\/Northwind\.svc\/Customers\('([^']+)'\)$/);
  if (m) {
    const row = customers.find((c) => c.CustomerID === m[1]);
    if (!row) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: { code: 'NotFound', message: `Customer '${m[1]}' not found` } }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ '@odata.context': '$metadata#Customers/$entity', ...row }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: { code: 'NotFound', message: `No handler for ${pathOnly}` } }));
});

server.listen(PORT, () => {
  console.log(`Northwind V4 mock listening on http://localhost:${PORT}`);
});
