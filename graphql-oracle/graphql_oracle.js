// graphql_oracle.js
const express = require('express');
const graphql = require('express-graphql');
const graphqlTools = require('graphql-tools');
const oracledb = require("oracledb");

const app = express();
var port = process.env.PORT || 3001;

let dbConfig = {
  /* 
  * user: process.env.NODE_ORACLEDB_USER,
  * password: process.env.NODE_ORACLEDB_PASSWORD,
  * connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING
  * */
  user: 'CORELIMS_MAIN',
  password: 'lims#1',
  //connectString: 'jdbc:oracle:thin:CORELIMS_MAIN/lims#1@127.0.0.1:49161:xe.oracle.docker'
  connectString: '( DESCRIPTION=( ADDRESS=(PROTOCOL=tcp) (HOST=127.0.0.1) (PORT=49161) )( CONNECT_DATA=(SERVICE_NAME=xe.oracle.docker) ) )'
}

oracledb.fetchAsString = [oracledb.CLOB];

process
  .on('SIGTERM', function() {
    console.log("\nTerminating");
    process.exit(0);
  })
  .on('SIGINT', function() {
    console.log("\nTerminating");
    process.exit(0);
  });

// Simple Blog schema with ID, Title and Content fields
const typeDefs = `
type Query {
  blogs: [Blog],
  blog(id: Int): Blog,
  ui_maps: [Ui_Map],
  entities: [Entity]
}

type Blog {
  id: Int!,
  title: String!,
  content: String!
}

type Entity {
  entity_id: Int,
  entity_name: String,
  barcode: String
}

type Ui_Map {
  ui_map_id: Int!,
  command_key: String 
}

input BlogEntry {
  title: String!,
  content: String!
}

type Mutation {
  createBlog(input: BlogEntry): Blog!,
  updateBlog(id: Int, input: BlogEntry): Blog!,
  deleteBlog(id: Int): Blog!
}
`;


async function getAllBlogsHelper() {
  let sql = 'SELECT b.blog FROM blogtable b';
  let conn = await oracledb.getConnection();
  let result = await conn.execute(sql);
  await conn.close();
  let j = [];
  for (let r of result.rows)  {
    j.push(JSON.parse(r));
  }
  return j;
}

async function getOneBlogHelper(id) {
  let sql = 'SELECT b.blog FROM blogtable b WHERE b.blog.id = :id';
  let binds = [id];
  let conn = await oracledb.getConnection();
  let result = await conn.execute(sql, binds);
  await conn.close();
  return JSON.parse(result.rows[0][0]);
}

async function getAllEntities () {
    
  let sql = 'SELECT ENTITY_ID, ENTITY_NAME, BARCODE FROM ENTITY where rownum <= 200';
  let conn = await oracledb.getConnection();
  let result = await conn.execute(sql);
  await conn.close();
  
  let j = [];
  for (let r of result.rows)  {
    let link = `<div>${r[1]}</div>`
    j.push({'entity_id': r[0], 'entity_name': link, 'barcode': r[2]});
  }
  return j;
}

async function getAllUiMaps () {
    
    let sql = 'SELECT UI_MAP_ID, COMMAND_KEY FROM UI_MAP';
    let conn = await oracledb.getConnection();
    let result = await conn.execute(sql);
    await conn.close();
    
    let j = [];
    for (let r of result.rows)  {
      j.push({'ui_map_id': r[0],'command_key': r[1]});
    }
    return j;
}

async function createBlogHelper(input) {
  let sql = 'BEGIN SELECT blog_seq.nextval INTO :id FROM dual; END;';
  let conn = await oracledb.getConnection();
  let binds = {id: {dir: oracledb.BIND_OUT, type: oracledb.NUMBER }};
  let result = await conn.execute(sql, binds);
  const newBlog = {id: result.outBinds.id, title: input.title, content: input.content};
  const js = JSON.stringify(newBlog);
  sql = 'INSERT INTO blogtable (blog) VALUES(:b)';
  binds = [js];
  result = await conn.execute(sql, binds, {autoCommit: true});
  await conn.close();
  return newBlog;
}

async function updateBlogHelper(id, input) {
  let sql = 'SELECT b.blog FROM blogtable b WHERE b.blog.id = :id';
  let binds = [id];
  let conn = await oracledb.getConnection();
  let result = await conn.execute(sql, binds);
  let j = JSON.parse(result.rows[0][0]);
  j.title = input.title;
  j.content = input.content;
  const js = JSON.stringify(j);
  sql = 'DELETE FROM blogtable b WHERE b.blog.id = :id';
  result = await conn.execute(sql, binds, {autoCommit: false});
  sql = 'INSERT INTO blogtable (blog) VALUES(:b)';
  binds = [js];
  result = await conn.execute(sql, binds, {autoCommit: true});
  await conn.close();
  return j;
}

async function deleteBlogHelper(id) {
  let sql = 'SELECT b.blog FROM blogtable b WHERE b.blog.id = :id';
  let binds = [id];
  let conn = await oracledb.getConnection();
  let result = await conn.execute(sql, binds);
  if (result.rows.length === 0)
    return null;
  let j = JSON.parse(result.rows[0][0]);
  sql = 'DELETE FROM blogtable b WHERE b.blog.id = :id';
  result = await conn.execute(sql, binds, {autoCommit: true});
  await conn.close();
  return j;
}

// Resolver to match the GraphQL query and return data
const resolvers = {
  Query: {
    blogs(root, args, context, info) {
      return getAllBlogsHelper();
    },
    blog(root, {id}, context, info) {
      return getOneBlogHelper(id);
    },
    ui_maps(root, args, context, info){
      return getAllUiMaps();
    },
    entities(root, args, context, info){
      return getAllEntities();
    }
  },
  Mutation: {
    createBlog(root, {input}, context, info) {
      return createBlogHelper(input);
    },

    updateBlog(root, {id, input}, context, info) {
      return updateBlogHelper(id, input);
    },

    deleteBlog(root, {id}, context, info) {
      return deleteBlogHelper(id);
    }
  }
};

// Build the schema with Type Definitions and Resolvers
const schema = graphqlTools.makeExecutableSchema({typeDefs, resolvers});

// Create a DB connection pool
async function startOracle() {
  try {
    await oracledb.createPool(dbConfig);
    console.log("Connection Pool Created");
  } catch (err) {
    console.log("Connection Pool Error");
    console.error(err);
  }
}

// Start the webserver
async function ws() {
  app.use('/graphql', graphql({
    graphiql: true,
    schema
  }));

  app.listen(port, function() {
    console.log('Listening on http://localhost:' + port + '/graphql');
  })
}

// Do it
async function run() {
  await startOracle();
  await ws();
}

run();