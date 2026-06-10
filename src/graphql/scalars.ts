import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

// Scalar JSON pass-through. Dipakai agar bentuk payload tiap operasi identik dengan
// respons REST lama (objek `data` dari `ok(c, data)`) tanpa perlu mengetik ulang setiap field.
function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {};
      for (const field of ast.fields) obj[field.name.value] = parseLiteral(field.value);
      return obj;
    }
    default:
      return undefined;
  }
}

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Nilai JSON arbitrer (pass-through).',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral,
});
