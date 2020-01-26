const { graphql, buildSchema } = require('graphql');
const graphqlTools = require('graphql-tools');
const graphqlToolsFork = require('graphql-tools-fork');

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

const query = `
  {
    test {
      id
      value
    }
  }
`;

const calls = 100;

async function runConsecutiveTestSet(libraryName, test, query, calls) {
  const testName = libraryName + ' ' + test.name;
  console.time(testName);
  for (let i = 0; i < calls; i++) {
    await graphql(test.schema, query);
  }
  console.timeEnd(testName);
}

function generatePromises(schema, query, calls) {
  const promises = [];
  for (let i = 0; i < calls; i++) {
    promises.push(graphql(schema, query));
  }
  return promises;
}

async function runConcurrentTestSet(libraryName, test, query, calls) {
  const testName = libraryName + ' ' + test.name;
  console.time(testName);
  await Promise.all(generatePromises(test.schema, query, calls));
  console.timeEnd(testName);
}

async function runAllTests(library) {
  const {
    makeExecutableSchema,
    mergeSchemas,
    delegateToSchema,
    addResolveFunctionsToSchema,
    transformSchema,
  } = library.code;

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const delegateSchema = buildSchema(typeDefs[0]);
  addResolveFunctionsToSchema({
    schema: delegateSchema,
    resolvers: {
      Query: ['test'].reduce((result, name) => {
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
    },
  });

  const mergedSchema = mergeSchemas({
    schemas: [schema],
  });

  const transformedSchema = transformSchema(schema, []);

  const mergedTransformedSchema = mergeSchemas({
    schemas: [transformedSchema],
  });
  
  const tests = [
    { name: 'direct', schema: schema, },
    { name: 'delegate', schema: delegateSchema, },
    { name: 'merged', schema: mergedSchema, },
    { name: 'transformed', schema: transformedSchema, },
    { name: 'mergedTransformed', schema: mergedTransformedSchema, },
  ];

  if (library.name === 'graphql-tools-fork') {

    const integratedMergedTransformed = mergeSchemas({
      schemas: [{
        schema,
        transforms: [],
      }],
    });

    tests.push({ name: 'integratedMergedTransformed', schema: integratedMergedTransformed });
  }

  console.log('\nconsecutive tests (' + calls + '):\n');
  for (let i = 0; i < tests.length; i++) {
    await runConsecutiveTestSet(library.name, tests[i], query, calls);
  }

  console.log('\nconcurrent tests (' + calls + '):\n');
  for (let i = 0; i < tests.length; i++) {
    await runConcurrentTestSet(library.name, tests[i], query, calls);
  }
}

const libraries = [
  { name: 'graphql-tools', code: graphqlTools },
  { name: 'graphql-tools-fork', code: graphqlToolsFork }
];

(async () => {
  for (let i = 0; i < libraries.length; i++) {
    await runAllTests(libraries[i]);
  }
})();