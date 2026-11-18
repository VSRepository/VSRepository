import { expectTypeOf } from "vitest";
import type { InferMethodReturn } from "../utils/infer-method-return.type.js";
import type { InferMethodType } from "../utils/infer-method-type.type.js";
import type { MethodOptions } from "../utils/method-options.type.js";
import type { SimpleMethodOptions } from "../utils/simple-method-options.type.js";
import type { VSRepoRelationsOptions } from "./vsrepo-relations-options.type.js";

// These are compile-time checks: `bun run typecheck` is what fails if the types regress.

type Comment = { id: string; text: string; createdAt: Date; reviewer?: User };
type Post = { id: string; title: string; published: boolean; createdAt: Date; comments: Comment[]; author: User };
type Profile = { id: string; bio: string };
type User = { id: string; name: string; posts: Post[]; profile: Profile | null };

describe("VSRepoRelationsOptions (types)", () => {
    it("should only have the relation fields of the entity as keys", () => {
        expectTypeOf<keyof VSRepoRelationsOptions<User>>().toEqualTypeOf<"posts" | "profile">();
        expectTypeOf<keyof VSRepoRelationsOptions<Post>>().toEqualTypeOf<"comments" | "author">();
    });

    it("should accept where, order and pagination on to-many relations, and nested relationsOptions", () => {
        const options = {
            posts: {
                where: { published: true, title: { contains: "a" } },
                order: { createdAt: "desc" },
                pagination: { limit: 10, offset: 5 },
                relationsOptions: { comments: { order: [{ createdAt: "asc" }], pagination: { limit: 3 } } },
            },
        } satisfies VSRepoRelationsOptions<User>;

        expectTypeOf(options).toExtend<VSRepoRelationsOptions<User>>();
    });

    it("should accept where and relationsOptions on optional to-one relations, but not order and pagination", () => {
        const options = {
            profile: { where: { bio: "x" } },
        } satisfies VSRepoRelationsOptions<User>;

        expectTypeOf(options).toExtend<VSRepoRelationsOptions<User>>();
        // nullable (`Profile | null`) and optional (`reviewer?: User`) relations
        expectTypeOf<NonNullable<VSRepoRelationsOptions<User>["profile"]>>().toHaveProperty("where");
        expectTypeOf<NonNullable<VSRepoRelationsOptions<Comment>["reviewer"]>>().toHaveProperty("where");
        expectTypeOf<NonNullable<VSRepoRelationsOptions<User>["profile"]>>().not.toHaveProperty("order");
        expectTypeOf<NonNullable<VSRepoRelationsOptions<User>["profile"]>>().not.toHaveProperty("pagination");
        expectTypeOf<NonNullable<VSRepoRelationsOptions<User>["posts"]>>().toHaveProperty("where");
        expectTypeOf<NonNullable<VSRepoRelationsOptions<User>["posts"]>>().toHaveProperty("order");
        expectTypeOf<NonNullable<VSRepoRelationsOptions<User>["posts"]>>().toHaveProperty("pagination");
    });

    it("should accept only relationsOptions on required to-one relations", () => {
        // `Post.author` is required: filtering it out would leave `null` where the type says `User`
        type AuthorOptions = NonNullable<VSRepoRelationsOptions<Post>["author"]>;

        expectTypeOf<AuthorOptions>().toHaveProperty("relationsOptions");
        expectTypeOf<AuthorOptions>().not.toHaveProperty("where");
        expectTypeOf<AuthorOptions>().not.toHaveProperty("order");
        expectTypeOf<AuthorOptions>().not.toHaveProperty("pagination");
    });

    it("should reject unknown relations, scalar fields and invalid values", () => {
        // @ts-expect-error unknown relation
        const unknownRelation: VSRepoRelationsOptions<User> = { postz: {} };
        // @ts-expect-error scalar fields are not relations
        const scalarField: VSRepoRelationsOptions<User> = { name: {} };
        // @ts-expect-error `order` is exclusive to to-many relations
        const orderOnToOne: VSRepoRelationsOptions<User> = { profile: { order: { bio: "asc" } } };
        // @ts-expect-error `pagination` is exclusive to to-many relations
        const paginationOnToOne: VSRepoRelationsOptions<User> = { profile: { pagination: { limit: 1 } } };
        // @ts-expect-error unknown field in the `where` of the relation
        const unknownWhereField: VSRepoRelationsOptions<User> = { posts: { where: { nope: 1 } } };
        // @ts-expect-error invalid sort direction
        const invalidDirection: VSRepoRelationsOptions<User> = { posts: { order: { createdAt: "up" } } };
        // @ts-expect-error unknown relation in the nested relationsOptions
        const unknownNested: VSRepoRelationsOptions<User> = { posts: { relationsOptions: { commentz: {} } } };
        // @ts-expect-error `where` is not available on a required to-one relation
        const whereOnRequired: VSRepoRelationsOptions<Post> = { author: { where: { name: "a" } } };

        expect([
            unknownRelation,
            scalarField,
            orderOnToOne,
            paginationOnToOne,
            unknownWhereField,
            invalidDirection,
            unknownNested,
            whereOnRequired,
        ]).toHaveLength(8);
    });

    it("should be accepted by MethodOptions and SimpleMethodOptions, but not change the inferred return", () => {
        expectTypeOf<MethodOptions<User>>().toHaveProperty("relationsOptions");
        expectTypeOf<SimpleMethodOptions<User>>().toHaveProperty("relationsOptions");

        const options = {
            relations: { posts: true },
            relationsOptions: { posts: { pagination: { limit: 1 } } },
        } satisfies MethodOptions<User>;
        const onlyRelationsOptions = {
            relationsOptions: { posts: { pagination: { limit: 1 } } },
        } satisfies MethodOptions<User>;

        expectTypeOf<InferMethodReturn<User[], typeof options>[number]>().toHaveProperty("posts");
        // `relationsOptions` doesn't load the relation by itself
        expectTypeOf<InferMethodReturn<User[], typeof onlyRelationsOptions>[number]>().not.toHaveProperty("posts");
    });

    it("should be validated on InferMethodType, including the cardinality of nested relations", () => {
        type Method = InferMethodType<[name: string], User[]>;
        const method = null as unknown as Method;

        void (() => {
            void method("a", {
                relations: { posts: true },
                relationsOptions: {
                    posts: {
                        order: { createdAt: "desc" },
                        relationsOptions: { comments: { pagination: { limit: 1 } } },
                    },
                },
            });
            void method("a", {
                relations: { profile: true },
                relationsOptions: { profile: { where: { bio: "x" } } },
            });
            void method("a", {
                relations: { posts: true },
                // @ts-expect-error `where` is not available on a required to-one relation
                relationsOptions: { posts: { relationsOptions: { author: { where: { name: "a" } } } } },
            });
            void method("a", {
                relations: { posts: true },
                relationsOptions: {
                    posts: {
                        relationsOptions: { author: { relationsOptions: { posts: { pagination: { limit: 1 } } } } },
                    },
                },
            });
            void method("a", {
                relations: { profile: true },
                // @ts-expect-error `order` is exclusive to to-many relations
                relationsOptions: { profile: { order: { bio: "asc" } } },
            });
            void method("a", {
                relations: { posts: true },
                // @ts-expect-error unknown relation
                relationsOptions: { postz: {} },
            });
            void method("a", {
                relations: { posts: true },
                // @ts-expect-error unknown key in the options of the relation
                relationsOptions: { posts: { foo: 1 } },
            });
            void method("a", {
                relations: { posts: true },
                // @ts-expect-error unknown relation in the nested relationsOptions
                relationsOptions: { posts: { relationsOptions: { commentz: {} } } },
            });
        });

        expect(method).toBeNull();
    });
});
