const { graphql } = require('graphql');
const { makeExecutableSchema, mergeSchemas } = require('graphql-tools');

const typeDefs = [`
  type Query {
    test: [Test]
  }

  type Test {
    id: Float!
    value: Float!
  }
`];

const test = Array.from({ length: 2000 }, (v, id) => ({ id, value: Math.random() }));

const resolvers = {
  Query: {
    test: () => test,
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
const mergedSchema = mergeSchemas({
  schemas: [schema],
});

const query = `
  {
    test {
      id
      value
    }
  }
`;

const calls = 20;

(async () => {
  console.time('direct');
  for (let i = 0; i < calls; i++) {
    await graphql(schema, query);
  }
  console.timeEnd('direct');

  console.time('merged');
  for (let i = 0; i < calls; i++) {
    await graphql(mergedSchema, query);
  }
  console.timeEnd('merged');
})();
