import { DeepPartial } from "../../types/utils/deep-partial.type.js";
import { MergeConfig } from "../../types/utils/merge-config.type.js";
import { PlainObject } from "../../types/utils/plain-object.type.js";

export class MergeEntitiesResolver {
    static resolve<Entity, U extends DeepPartial<Entity>>(
        target: Entity,
        source: U,
        mergeConfig?: MergeConfig<Entity>,
    ): Entity & U {
        const targetAny = target as PlainObject;
        const sourceAny = source as PlainObject;

        for (const [key, value] of Object.entries(sourceAny)) {
            if (value === undefined && mergeConfig?.undefinedBehavior !== "keep") {
                continue;
            }
            if (value === null && mergeConfig?.nullBehavior === "ignore") {
                continue;
            }

            const fieldConfig = mergeConfig?.fields?.[key as keyof Entity];

            if (fieldConfig) {
                if (fieldConfig.strategy === "to-one") {
                    targetAny[key] =
                        value === null
                            ? null
                            : this.resolve(targetAny[key] ?? {}, value, {
                                  nullBehavior: mergeConfig?.nullBehavior,
                                  undefinedBehavior: mergeConfig?.undefinedBehavior,
                                  fields: fieldConfig.fields as any,
                              });
                } else if (fieldConfig.strategy === "to-many") {
                    targetAny[key] = this.mergeToManyRelation(
                        Array.isArray(targetAny[key]) ? targetAny[key] : [],
                        value,
                        fieldConfig.pk,
                        {
                            nullBehavior: mergeConfig?.nullBehavior,
                            undefinedBehavior: mergeConfig?.undefinedBehavior,
                            fields: fieldConfig.fields as any,
                        },
                    );
                } else if (fieldConfig.strategy === "concat") {
                    targetAny[key] =
                        fieldConfig.whosFirst === "source"
                            ? value.concat(targetAny[key])
                            : targetAny[key].concat(value);
                }

                continue;
            }

            targetAny[key] = value;
        }

        return targetAny as Entity & U;
    }

    private static mergeToManyRelation<Entity>(
        target: PlainObject[],
        source: PlainObject[],
        relationPk: string,
        mergeConfig?: MergeConfig<PlainObject>,
    ): PlainObject[] {
        const targetMap = new Map<any, PlainObject>();
        const targetWithoutPk: PlainObject[] = [];

        for (const item of target) {
            if (item[relationPk] !== undefined) {
                targetMap.set(item[relationPk], item);
            } else {
                targetWithoutPk.push(item);
            }
        }

        const sourceWithoutPk: PlainObject[] = [];

        for (const item of source) {
            if (item[relationPk] === undefined) {
                sourceWithoutPk.push(item);
                continue;
            }

            const targetItem = targetMap.get(item[relationPk]);
            const mergedItem = targetItem
                ? this.resolve(targetItem as Entity, item as DeepPartial<Entity>, mergeConfig as MergeConfig<Entity>)
                : item;
            targetMap.set(item[relationPk], mergedItem as PlainObject);
        }

        return [...targetMap.values(), ...targetWithoutPk, ...sourceWithoutPk];
    }
}
