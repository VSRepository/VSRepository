import { MergeConfig } from "../../types/utils/merge-config.type.js";
import { MergeEntitiesResolver } from "./merge-entities.resolver.js";

interface Address {
    id: number;
    street: string;
    city?: string;
}

interface Post {
    id?: number;
    title: string;
    likes?: number;
}

interface User {
    id: string;
    name: string;
    nickname: string | null;
    age?: number;
    tags: string[];
    address: Address | null;
    posts: Post[];
}

describe("MergeEntitiesResolver", () => {
    let user: User;

    beforeEach(() => {
        user = {
            id: "1",
            name: "Ana",
            nickname: "ani",
            age: 20,
            tags: ["a", "b"],
            address: { id: 1, street: "Main St", city: "Rio" },
            posts: [
                { id: 1, title: "first", likes: 1 },
                { id: 2, title: "second", likes: 2 },
            ],
        };
    });

    describe("resolve", () => {
        describe("without merge config", () => {
            it("should overwrite the target fields with the source ones", () => {
                const result = MergeEntitiesResolver.resolve(user, { name: "Maria", age: 30 });

                expect(result).toMatchObject({ id: "1", name: "Maria", age: 30, nickname: "ani" });
            });

            it("should keep the fields that are not in the source", () => {
                const result = MergeEntitiesResolver.resolve(user, { name: "Maria" });

                expect(result.nickname).toBe("ani");
                expect(result.tags).toEqual(["a", "b"]);
                expect(result.address).toEqual({ id: 1, street: "Main St", city: "Rio" });
            });

            it("should mutate and return the target itself", () => {
                const result = MergeEntitiesResolver.resolve(user, { name: "Maria" });

                expect(result).toBe(user);
                expect(user.name).toBe("Maria");
            });

            it("should not mutate the source", () => {
                const source = { name: "Maria", tags: ["c"] };

                MergeEntitiesResolver.resolve(user, source);

                expect(source).toEqual({ name: "Maria", tags: ["c"] });
            });

            it("should return the target untouched when the source is empty", () => {
                const before = structuredClone(user);

                const result = MergeEntitiesResolver.resolve(user, {});

                expect(result).toEqual(before);
            });

            it("should replace nested objects and arrays instead of merging them", () => {
                const address = { id: 9, street: "Other St" };
                const posts = [{ id: 7, title: "only" }];

                const result = MergeEntitiesResolver.resolve(user, { address, posts, tags: ["z"] });

                expect(result.address).toBe(address);
                expect(result.address).toEqual({ id: 9, street: "Other St" });
                expect(result.posts).toBe(posts);
                expect(result.tags).toEqual(["z"]);
            });

            it("should add fields that the target does not have yet", () => {
                const bare = { id: "2", name: "Caio" } as User;

                const result = MergeEntitiesResolver.resolve(bare, { age: 40 });

                expect(result.age).toBe(40);
            });
        });

        describe("undefinedBehavior", () => {
            it("should ignore undefined values by default", () => {
                const result = MergeEntitiesResolver.resolve(user, { name: undefined, age: 31 } as Partial<User>);

                expect(result.name).toBe("Ana");
                expect(result.age).toBe(31);
            });

            it("should ignore undefined values when set to ignore", () => {
                const result = MergeEntitiesResolver.resolve(user, { name: undefined } as Partial<User>, {
                    undefinedBehavior: "ignore",
                });

                expect(result.name).toBe("Ana");
            });

            it("should write undefined values when set to keep", () => {
                const result = MergeEntitiesResolver.resolve(user, { age: undefined }, { undefinedBehavior: "keep" });

                expect(result.age).toBeUndefined();
                expect("age" in result).toBe(true);
            });
        });

        describe("nullBehavior", () => {
            it("should write null values by default", () => {
                const result = MergeEntitiesResolver.resolve(user, { nickname: null });

                expect(result.nickname).toBeNull();
            });

            it("should write null values when set to keep", () => {
                const result = MergeEntitiesResolver.resolve(user, { nickname: null }, { nullBehavior: "keep" });

                expect(result.nickname).toBeNull();
            });

            it("should ignore null values when set to ignore", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { nickname: null, name: "Maria" },
                    { nullBehavior: "ignore" },
                );

                expect(result.nickname).toBe("ani");
                expect(result.name).toBe("Maria");
            });
        });

        describe("to-one strategy", () => {
            const mergeConfig: MergeConfig<User> = { fields: { address: { strategy: "to-one" } } };

            it("should merge the nested object field by field", () => {
                const result = MergeEntitiesResolver.resolve(user, { address: { street: "New St" } }, mergeConfig);

                expect(result.address).toEqual({ id: 1, street: "New St", city: "Rio" });
            });

            it("should merge into the existing nested object, not into a copy", () => {
                const address = user.address;

                MergeEntitiesResolver.resolve(user, { address: { street: "New St" } }, mergeConfig);

                expect(user.address).toBe(address);
            });

            it("should create the nested object when the target has none", () => {
                user.address = null;

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { address: { id: 5, street: "New St" } },
                    mergeConfig,
                );

                expect(result.address).toEqual({ id: 5, street: "New St" });
            });

            it("should set the relation to null when the source is null", () => {
                const result = MergeEntitiesResolver.resolve(user, { address: null }, mergeConfig);

                expect(result.address).toBeNull();
            });

            it("should keep the relation when the source is null and nullBehavior is ignore", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { address: null },
                    { ...mergeConfig, nullBehavior: "ignore" },
                );

                expect(result.address).toEqual({ id: 1, street: "Main St", city: "Rio" });
            });

            it("should keep the relation when the source field is undefined", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { address: undefined } as Partial<User>,
                    mergeConfig,
                );

                expect(result.address).toEqual({ id: 1, street: "Main St", city: "Rio" });
            });

            it("should replace the nested object with undefined when undefinedBehavior is keep", () => {
                const result = MergeEntitiesResolver.resolve(user, { address: undefined } as Partial<User>, {
                    ...mergeConfig,
                    undefinedBehavior: "keep",
                });

                expect(result.address).toBeUndefined();
            });

            it("should overwrite the nested object with undefined when an undefined source is kept", () => {
                const address = user.address;

                MergeEntitiesResolver.resolve(user, { address: undefined } as Partial<User>, {
                    ...mergeConfig,
                    undefinedBehavior: "keep",
                });

                expect(user.address).toBeUndefined();
                expect(user.address).not.toBe(address);
            });

            it("should end up undefined when the target has none and the source is undefined and kept", () => {
                user.address = null;

                const result = MergeEntitiesResolver.resolve(user, { address: undefined } as Partial<User>, {
                    ...mergeConfig,
                    undefinedBehavior: "keep",
                });

                expect(result.address).toBeUndefined();
                expect("address" in result).toBe(true);
            });

            it("should end up undefined when the target field is undefined and the source is undefined and kept", () => {
                user.address = undefined as any;

                const result = MergeEntitiesResolver.resolve(user, { address: undefined } as Partial<User>, {
                    ...mergeConfig,
                    undefinedBehavior: "keep",
                });

                expect(result.address).toBeUndefined();
            });

            it("should still set the relation to null when the source is null and undefinedBehavior is keep", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { address: null },
                    {
                        ...mergeConfig,
                        undefinedBehavior: "keep",
                    },
                );

                expect(result.address).toBeNull();
            });

            it("should propagate nullBehavior to the nested object", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { address: { street: "New St", city: null as any } },
                    { ...mergeConfig, nullBehavior: "ignore" },
                );

                expect(result.address).toEqual({ id: 1, street: "New St", city: "Rio" });
            });

            it("should propagate undefinedBehavior to the nested object", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { address: { street: "New St", city: undefined } },
                    { ...mergeConfig, undefinedBehavior: "keep" },
                );

                expect(result.address?.street).toBe("New St");
                expect(result.address?.city).toBeUndefined();
            });

            it("should apply the nested fields config", () => {
                const nested: MergeConfig<User> = {
                    fields: { address: { strategy: "to-one", fields: {} } },
                };

                const result = MergeEntitiesResolver.resolve(user, { address: { city: "SP" } }, nested);

                expect(result.address).toEqual({ id: 1, street: "Main St", city: "SP" });
            });
        });

        describe("to-many strategy", () => {
            const mergeConfig: MergeConfig<User> = { fields: { posts: { strategy: "to-many", pk: "id" } } };

            it("should merge the items that share the pk", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { posts: [{ id: 2, title: "edited" }] },
                    mergeConfig,
                );

                expect(result.posts).toEqual([
                    { id: 1, title: "first", likes: 1 },
                    { id: 2, title: "edited", likes: 2 },
                ]);
            });

            it("should keep the target items that are not in the source", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { posts: [{ id: 1, title: "edited" }] },
                    mergeConfig,
                );

                expect(result.posts).toHaveLength(2);
                expect(result.posts[1]).toEqual({ id: 2, title: "second", likes: 2 });
            });

            it("should append the source items that are new", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: [{ id: 3, title: "third" }] }, mergeConfig);

                expect(result.posts.map(p => p.id)).toEqual([1, 2, 3]);
                expect(result.posts[2]).toEqual({ id: 3, title: "third" });
            });

            it("should append the source items that have no pk", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: [{ title: "draft" }] }, mergeConfig);

                expect(result.posts).toHaveLength(3);
                expect(result.posts[2]).toEqual({ title: "draft" });
            });

            it("should keep the target items that have no pk", () => {
                user.posts.push({ title: "target draft" });

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { posts: [{ id: 1, title: "edited" }] },
                    mergeConfig,
                );

                expect(result.posts).toContainEqual({ title: "target draft" });
                expect(result.posts).toHaveLength(3);
            });

            it("should order the result as: items with pk, target without pk, source without pk", () => {
                user.posts = [{ title: "target draft" }, { id: 1, title: "first" }];

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { posts: [{ title: "source draft" }, { id: 3, title: "third" }] },
                    mergeConfig,
                );

                expect(result.posts).toEqual([
                    { id: 1, title: "first" },
                    { id: 3, title: "third" },
                    { title: "target draft" },
                    { title: "source draft" },
                ]);
            });

            it("should merge the existing item in place", () => {
                const first = user.posts[0];

                MergeEntitiesResolver.resolve(user, { posts: [{ id: 1, title: "edited" }] }, mergeConfig);

                expect(user.posts[0]).toBe(first);
                expect(first?.title).toBe("edited");
            });

            it("should add the new source item by reference", () => {
                const item = { id: 3, title: "third" };

                const result = MergeEntitiesResolver.resolve(user, { posts: [item] }, mergeConfig);

                expect(result.posts[2]).toBe(item);
            });

            it("should start from an empty list when the target relation is not an array", () => {
                user.posts = null as any;

                const result = MergeEntitiesResolver.resolve(user, { posts: [{ id: 3, title: "third" }] }, mergeConfig);

                expect(result.posts).toEqual([{ id: 3, title: "third" }]);
            });

            it("should keep the whole list when the source list is empty", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: [] }, mergeConfig);

                expect(result.posts).toEqual([
                    { id: 1, title: "first", likes: 1 },
                    { id: 2, title: "second", likes: 2 },
                ]);
            });

            it("should keep the list when the source field is undefined", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: undefined } as Partial<User>, mergeConfig);

                expect(result.posts).toHaveLength(2);
            });

            it("should set the relation to null when the source is null", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: null } as any, mergeConfig);

                expect(result.posts).toBeNull();
            });

            it("should set the relation to undefined when undefinedBehavior is keep", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: undefined } as Partial<User>, {
                    ...mergeConfig,
                    undefinedBehavior: "keep",
                });

                expect(result.posts).toBeUndefined();
            });

            it("should keep the null value when nullBehavior is keep", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: null } as any, {
                    ...mergeConfig,
                    nullBehavior: "keep",
                });

                expect(result.posts).toBeNull();
            });

            it("should keep the list when the source is null and nullBehavior is ignore", () => {
                const result = MergeEntitiesResolver.resolve(user, { posts: null } as any, {
                    ...mergeConfig,
                    nullBehavior: "ignore",
                });

                expect(result.posts).toHaveLength(2);
            });

            it("should keep the null value when the target and the null source are empty", () => {
                user.posts = [];

                const result = MergeEntitiesResolver.resolve(user, { posts: null } as any, mergeConfig);

                expect(result.posts).toBeNull();
            });

            it("should apply the nested config to the merged items", () => {
                const nested: MergeConfig<User> = {
                    fields: { posts: { strategy: "to-many", pk: "id" } },
                    nullBehavior: "ignore",
                };

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { posts: [{ id: 1, title: "edited", likes: null as any }] },
                    nested,
                );

                expect(result.posts[0]).toEqual({ id: 1, title: "edited", likes: 1 });
            });
        });

        describe("concat strategy", () => {
            it("should append the source after the target by default", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c"] },
                    { fields: { tags: { strategy: "concat" } } },
                );

                expect(result.tags).toEqual(["a", "b", "c"]);
            });

            it("should append the source after the target when whosFirst is target", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c"] },
                    { fields: { tags: { strategy: "concat", whosFirst: "target" } } },
                );

                expect(result.tags).toEqual(["a", "b", "c"]);
            });

            it("should put the source before the target when whosFirst is source", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c"] },
                    { fields: { tags: { strategy: "concat", whosFirst: "source" } } },
                );

                expect(result.tags).toEqual(["c", "a", "b"]);
            });

            it("should not deduplicate repeated values", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["a"] },
                    { fields: { tags: { strategy: "concat" } } },
                );

                expect(result.tags).toEqual(["a", "b", "a"]);
            });

            it("should deduplicate repeated values", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["a", "c"] },
                    { fields: { tags: { strategy: "concat", deduplicate: true } } },
                );

                expect(result.tags).toEqual(["a", "b", "c"]);
            });

            it("should deduplicate repeated values respecting whosFirst", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["a", "c"] },
                    { fields: { tags: { strategy: "concat", whosFirst: "source", deduplicate: true } } },
                );

                expect(result.tags).toEqual(["a", "c", "b"]);
            });

            it("should assign null when the source is null", () => {
                const result = MergeEntitiesResolver.resolve(user, { tags: null } as any, {
                    fields: { tags: { strategy: "concat" } },
                });

                expect(result.tags).toBeNull();
            });

            it("should assign null when the source is null and whosFirst is source", () => {
                const result = MergeEntitiesResolver.resolve(user, { tags: null } as any, {
                    fields: { tags: { strategy: "concat", whosFirst: "source" } },
                });

                expect(result.tags).toBeNull();
            });

            it("should assign undefined when undefinedBehavior is keep", () => {
                const result = MergeEntitiesResolver.resolve(user, { tags: undefined } as Partial<User>, {
                    undefinedBehavior: "keep",
                    fields: { tags: { strategy: "concat" } },
                });

                expect(result.tags).toBeUndefined();
            });

            it("should keep the array when the source is null and nullBehavior is ignore", () => {
                const result = MergeEntitiesResolver.resolve(user, { tags: null } as any, {
                    nullBehavior: "ignore",
                    fields: { tags: { strategy: "concat" } },
                });

                expect(result.tags).toEqual(["a", "b"]);
            });

            it("should treat a target that is not an array as an empty list", () => {
                user.tags = null as any;

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c"] },
                    { fields: { tags: { strategy: "concat" } } },
                );

                expect(result.tags).toEqual(["c"]);
            });

            it("should treat a target that is not an array as an empty list when whosFirst is source", () => {
                delete (user as Partial<User>).tags;

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c"] },
                    { fields: { tags: { strategy: "concat", whosFirst: "source" } } },
                );

                expect(result.tags).toEqual(["c"]);
            });

            it("should keep null when both the target and the source are null", () => {
                user.tags = null as any;

                const result = MergeEntitiesResolver.resolve(user, { tags: null } as any, {
                    fields: { tags: { strategy: "concat" } },
                });

                expect(result.tags).toBeNull();
            });

            it("should keep the array when the source field is undefined", () => {
                const result = MergeEntitiesResolver.resolve(user, { tags: undefined } as Partial<User>, {
                    fields: { tags: { strategy: "concat" } },
                });

                expect(result.tags).toEqual(["a", "b"]);
            });

            it("should return a new array instead of mutating the target one", () => {
                const original = user.tags;

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c"] },
                    { fields: { tags: { strategy: "concat" } } },
                );

                expect(result.tags).not.toBe(original);
                expect(original).toEqual(["a", "b"]);
            });
        });

        describe("fields without config", () => {
            it("should be overwritten even when other fields have a strategy", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { name: "Maria", tags: ["c"] },
                    { fields: { tags: { strategy: "concat" } } },
                );

                expect(result.name).toBe("Maria");
                expect(result.tags).toEqual(["a", "b", "c"]);
            });
        });

        describe("custom strategy", () => {
            it("should call customFn with the target and source values and use its return", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["c", "d"] },
                    {
                        fields: {
                            tags: {
                                strategy: "custom",
                                customFn: (target, source) => [...(target ?? []), ...(source ?? [])],
                            },
                        },
                    },
                );

                expect(result.tags).toEqual(["a", "b", "c", "d"]);
            });

            it("should allow customFn to replace the field value entirely", () => {
                const customFn = vi.fn((target: string[] | undefined, source: string[]) => [
                    ...(target ?? []),
                    ...source.filter(value => !target?.includes(value)),
                ]);

                const result = MergeEntitiesResolver.resolve(
                    user,
                    { tags: ["b", "c"] },
                    { fields: { tags: { strategy: "custom", customFn } } },
                );

                expect(customFn).toHaveBeenCalledWith(["a", "b"], ["b", "c"]);
                expect(result.tags).toEqual(["a", "b", "c"]);
            });
        });

        describe("combined strategies", () => {
            it("should apply every strategy in a single call", () => {
                const result = MergeEntitiesResolver.resolve(
                    user,
                    {
                        name: "Maria",
                        nickname: null,
                        tags: ["c"],
                        address: { city: "SP" },
                        posts: [{ id: 2, title: "edited" }, { title: "draft" }],
                    },
                    {
                        fields: {
                            tags: { strategy: "concat" },
                            address: { strategy: "to-one" },
                            posts: { strategy: "to-many", pk: "id" },
                        },
                    },
                );

                expect(result).toEqual({
                    id: "1",
                    name: "Maria",
                    nickname: null,
                    age: 20,
                    tags: ["a", "b", "c"],
                    address: { id: 1, street: "Main St", city: "SP" },
                    posts: [
                        { id: 1, title: "first", likes: 1 },
                        { id: 2, title: "edited", likes: 2 },
                        { title: "draft" },
                    ],
                });
            });
        });
    });
});
