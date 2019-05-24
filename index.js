const { graphql, buildSchema } = require('graphql');
const { makeExecutableSchema, mergeSchemas, delegateToSchema, addResolveFunctionsToSchema } = require('graphql-tools');

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
  const { data: { __schema: { queryType: { fields } } } } = await graphql(schema, '{ __schema { queryType { fields { name } } } }');
  const delegateResolvers = {
    Query: fields.reduce((result, { name }) => {
      result[name] = (root, args, context, info) => delegateToSchema({
        schema: schema,
        operation: 'query',
        fieldName: name,
        args,
        context,
        info,
      });
      return result;
    }, {}),
  };

  const delegateSchema = buildSchema(typeDefs[0]);
  addResolveFunctionsToSchema({
    schema: delegateSchema,
    resolvers: delegateResolvers,
  });

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

  console.time('delegate');
  for (let i = 0; i < calls; i++) {
    await graphql(delegateSchema, query);
  }
  console.timeEnd('delegate');
})();
