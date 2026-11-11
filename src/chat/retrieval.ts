import { tools, type ToolDef } from "@/tools/registry";

const stopwords = new Set(
    "a an and are as at be can do for from how i in into is it me of on or that the to use what with you your".split(
        " ",
    ),
);

function tokenize(value: string) {
    return (
        value
            .toLowerCase()
            .match(/[a-z0-9][a-z0-9+#.-]*/g)
            ?.filter((token) => !stopwords.has(token)) ?? []
    );
}

export function rankTools(query: string, limit = 5): ToolDef[] {
    const terms = tokenize(query);
    if (!terms.length) return tools.slice(0, limit);

    return tools
        .map((tool) => {
            const name = tokenize(tool.name);
            const keywords = (tool.keywords ?? []).flatMap(tokenize);
            const description = tokenize(tool.description);
            const category = tokenize(tool.category);
            let score = 0;
            for (const term of terms) {
                if (name.includes(term)) score += 12;
                if (keywords.includes(term)) score += 9;
                if (description.includes(term)) score += 4;
                if (category.includes(term)) score += 2;
                if (name.some((value) => value.startsWith(term))) score += 3;
                if (keywords.some((value) => value.startsWith(term)))
                    score += 2;
            }
            return { tool, score };
        })
        .filter(({ score }) => score > 0)
        .sort(
            (a, b) =>
                b.score - a.score || a.tool.name.localeCompare(b.tool.name),
        )
        .slice(0, limit)
        .map(({ tool }) => tool);
}
