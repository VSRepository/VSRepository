<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./transactions.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Transações

Todos os métodos (base, dinâmicos e de query) aceitam `options.db` para participar de uma transação compartilhada:

```typescript
await userRepository.transaction(async tx => {
    const usuario = await userRepository.save({ name: "Maria", email: "maria@email.com" }, { db: tx });

    await userLogsRepository.save({ action: "Usuário criado", data: { userId: usuario.id } }, { db: tx });
});
```

Repositories diferentes podem compartilhar a mesma transação, desde que seus adapters apontem para a mesma conexão do ORM por trás deles.

`transaction()` aceita um `VSRepoTransactionOptions` opcional como segundo argumento:

```typescript
import { VSRepoIsolationLevel } from "vsrepo";

await userRepository.transaction(
    async tx => {
        await userRepository.save({ name: "Maria", email: "maria@email.com" }, { db: tx });
    },
    { isolationLevel: VSRepoIsolationLevel.SERIALIZABLE, timeoutMs: 5000 },
);
```

| Option           | Type                        | Descrição                                                                          |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| `isolationLevel` | `VSRepoIsolationLevel` | Nível de isolamento usado na transação. O padrão é o default do ORM por trás dela. |
| `timeoutMs`      | `number`                    | Tempo máximo (em ms) que a transação pode rodar antes de ser abortada.             |

`VSRepoIsolationLevel` espelha os níveis de isolamento SQL padrão: `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`. O suporte a um determinado nível depende do adapter/ORM e do banco de dados por trás dele.

## Valor de retorno e propagação de erro

O `transaction()` retorna o que o callback retornar, então dá para calcular um resultado dentro da transação e usá-lo logo em seguida:

```typescript
const pedido = await orderRepository.transaction(async tx => {
    const criado = await orderRepository.save({ userId, total }, { db: tx });

    await orderItemsRepository.saveList(
        items.map(item => ({ ...item, orderId: criado.id })),
        { db: tx },
    );

    return criado;
});

console.log(pedido.id);
```

Se o callback lançar um erro, ele se propaga para fora do `transaction()` sem alterações, e é o adapter/ORM por trás dele quem desfaz a transação — o `VSRepository` em si não captura nem embrulha esse erro:

```typescript
try {
    await userRepository.transaction(async tx => {
        await userRepository.save({ name: "Maria", email: "maria@email.com" }, { db: tx });

        if (!(await algumaVerificacaoExterna())) {
            throw new Error("validação falhou"); // desfaz o save acima
        }
    });
} catch (err) {
    // a transação já foi desfeita quando isso roda
}
```

## Query builder dentro de uma transação

Um [query builder](./query-builder.pt-BR.md#query-builder) — ou um [raw query builder](./raw-query-builder.pt-BR.md#transações-e-setdb) — pode ser apontado para uma transação da mesma forma — seja criando ele com `createQueryBuilder(tx)`, seja de forma lazy com `setDb(tx)` depois que a transação já começou, o que permite montar a query antes mesmo de a transação existir:

```typescript
const qb = userRepository.createQueryBuilder().where({ active: true });

await userRepository.transaction(async tx => {
    qb.setDb(tx);
    return qb.getResult();
});
```

O [raw query builder](./raw-query-builder.pt-BR.md#raw-query-builder) funciona exatamente igual: crie-o com `createRawQueryBuilder(tx)` ou aponte-o para a transação depois, com `setDb(tx)`, e chame `execute()` dentro do callback:

```typescript
const rawQb = userRepository.createRawQueryBuilder().select("id", "name").from("user");

await userRepository.transaction(async tx => {
    rawQb.setDb(tx);
    return rawQb.execute();
});
```

[⬆️ Voltar ao topo](#top)
