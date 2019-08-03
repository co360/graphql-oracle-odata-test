// graphql_oracle.js
const express = require("express");
const graphql = require("express-graphql");
const graphqlTools = require("graphql-tools");

const fetch = require("node-fetch");
const odata = require("./node_modules/odata/dist/cjs/o.js");
const request = require("request");

// Express
const app = express();
var port = process.env.PORT || 3001;

// OData Connection Stuff
const connect = {
  api: "http://127.0.0.1:8080/pfs",
  username: "lims",
  password: "lims#1",
  tenant: "",
  auth: "",
  entityType: "",
  superType: "",
  oDataQuery: "",
  logoutURI: "#"
};

const createConnect = defaultConnect => {
  let endpoint = defaultConnect.api;
  let tenant = defaultConnect.tenant;
  let username = defaultConnect.username;
  let password = defaultConnect.password;
  let entityType = defaultConnect.entityType;
  let superType = defaultConnect.superType;
  let endpointWithTenant = tenant ? endpoint + "/" + tenant : endpoint;
  let auth = "Basic "+ Buffer.from(username + ":" + password).toString("base64");

  return {
    api: endpointWithTenant,
    apiWithoutTenant: endpoint,
    tenant: tenant,
    auth: auth,
    username: username,
    requestOptions: {
      headers: {
        Authorization: auth,
        "OData-MaxVersion": "4.0",
        "Content-Type": "application/json",
        Prefer: "odata.maxpagesize=99999999"
      }
    }
  };
};

const odataConnection = createConnect(connect);

process
  .on("SIGTERM", function() {
    console.log("\nTerminating");
    process.exit(0);
    ``;
  })
  .on("SIGINT", function() {
    console.log("\nTerminating");
    process.exit(0);
  });

// Simple Blog schema with ID, Title and Content fields
const typeDefs = `
type Query {
  ui_maps: [Ui_Map],
  beers: [Beer],
  metadata: String
}

type Beer {
  barcode: String,
  ci_brand: String,
  ci_tier: String,
  ci_color: String,
  ci_type: String,
}

type Ui_Map {
  ui_map_id: Int!,
  command_key: String 
}
`;

async function getMetadata() {

  /* Grabbing Metadata */
  fetch(`${odataConnection.api}/odata/$metadata`,odataConnection.requestOptions)
    .then(function(response) {
      return response.text();
    })
    .then(function(myJson) {
      console.log(JSON.stringify(myJson))
      return JSON.stringify(myJson)
    });

}

async function getAllBeer() {
  
  /* Weird Example */
  // odata.o(`${odataConnection.api}/odata/$metadata`,odataConnection.requestOptions)
  //   .get('BEER')
  //   .query()
  //   .then((data) => console.log(data));

  return odata.o(`${odataConnection.api}/odata/`,odataConnection.requestOptions)
    .get('BEER')
    .query({ $top: 10 })
    .then(data => {
      return data.map(d => ({barcode: d.Barcode, ci_color: d.CI_COLOR, ci_brand:d.CI_BRAND, ci_tier:d.CI_TIER, ci_type:d.CI_TYPE}));
    }) 
    
    // for (let b of data)  {
    //   j.push({'ci_brand': b[0],'ci_tier': b[1]});
    // }

    // let j = [];
    // for (let r of beers)  {
    //   j.push({'ci_brand': r[0],'ci_tier': r[1]});
    // }
    // return j;

}

async function getAllUiMaps() {
  let sql = "SELECT * FROM UI_MAP";
  let conn = await oracledb.getConnection();
  let result = await conn.execute(sql);
  await conn.close();
  let j = [];
  for (let r of result.rows) {
    j.push(JSON.parse(r));
  }
  return j;
}

// Resolver to match the GraphQL query and return data
const resolvers = {
  Query: {
    ui_maps(root, args, context, info) {
      return getAllUiMaps();
    },
    metadata(root, args, context, info){
      return getMetadata();
    },
    beers(root, args, context, info){
      return getAllBeer();
    }
  }
};

// Build the schema with Type Definitions and Resolvers
const schema = graphqlTools.makeExecutableSchema({ typeDefs, resolvers });

// Start the webserver
async function ws() {
  app.use('/graphql', graphql({
    graphiql: true,
    schema
  }));

  app.listen(port, function() {
    console.log("Listening on http://localhost:" + port + "/graphql");
  });
}

// Do it
async function run() {
  //await getMetadata();
  await ws();
}

run();