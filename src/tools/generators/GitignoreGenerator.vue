<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Search, X } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

interface Tpl { id: string; name: string; group: "Languages" | "Frameworks" | "Tools" | "Editors" | "OS"; rules: string }

const T: Tpl[] = [
    { id: "node", name: "Node.js", group: "Languages", rules: "node_modules/\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\n.pnpm-store/\n.npm/\n.yarn/cache\n.yarn/unplugged\n.yarn/install-state.gz\n.pnp.*\ndist/\nbuild/\ncoverage/\n.nyc_output/\n*.tsbuildinfo\n.eslintcache\n.env\n.env.*\n!.env.example" },
    { id: "python", name: "Python", group: "Languages", rules: "__pycache__/\n*.py[cod]\n*$py.class\n*.so\n.Python\nbuild/\ndist/\n*.egg-info/\n.eggs/\n.venv/\nvenv/\nenv/\n.pytest_cache/\n.mypy_cache/\n.ruff_cache/\n.tox/\n.coverage\nhtmlcov/\n.ipynb_checkpoints/\n.env" },
    { id: "java", name: "Java", group: "Languages", rules: "*.class\n*.jar\n*.war\n*.ear\n*.log\nhs_err_pid*\ntarget/\nbuild/\n.gradle/\n!gradle/wrapper/gradle-wrapper.jar\n.mvn/timing.properties\nout/" },
    { id: "go", name: "Go", group: "Languages", rules: "*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n*.test\n*.out\ngo.work\ngo.work.sum\nvendor/\nbin/" },
    { id: "rust", name: "Rust", group: "Languages", rules: "target/\n**/*.rs.bk\n*.pdb\n# Keep Cargo.lock for binaries; ignore it for libraries\n# Cargo.lock" },
    { id: "php", name: "PHP / Composer", group: "Languages", rules: "vendor/\ncomposer.phar\n.phpunit.result.cache\n.phpunit.cache/\n.php-cs-fixer.cache\n.env" },
    { id: "ruby", name: "Ruby", group: "Languages", rules: "*.gem\n*.rbc\n.bundle/\nvendor/bundle/\nlog/\ntmp/\ncoverage/\n.byebug_history\n.env" },
    { id: "dotnet", name: "C# / .NET", group: "Languages", rules: "bin/\nobj/\n*.user\n*.suo\n.vs/\n*.nupkg\nTestResults/\npackages/\n*.DotSettings.user" },
    { id: "cpp", name: "C / C++", group: "Languages", rules: "*.o\n*.obj\n*.a\n*.lib\n*.so\n*.dylib\n*.dll\n*.exe\n*.out\n*.gch\n*.pch\nbuild/\ncmake-build-*/\nCMakeCache.txt\nCMakeFiles/\ncompile_commands.json" },
    { id: "swift", name: "Swift / Xcode", group: "Languages", rules: "xcuserdata/\nDerivedData/\n*.xcuserstate\n.build/\n.swiftpm/\nPods/\nCarthage/Build/\n*.ipa\n*.dSYM.zip\n*.dSYM" },
    { id: "kotlin", name: "Kotlin / Android", group: "Languages", rules: "*.iml\n.gradle/\nlocal.properties\nbuild/\ncaptures/\n.externalNativeBuild/\n.cxx/\n*.apk\n*.aab\n*.keystore\n!debug.keystore" },
    { id: "dart", name: "Dart / Flutter", group: "Languages", rules: ".dart_tool/\n.packages\n.pub-cache/\n.pub/\nbuild/\n.flutter-plugins\n.flutter-plugins-dependencies\n*.g.dart\n*.freezed.dart" },

    { id: "react", name: "React / Vite", group: "Frameworks", rules: "node_modules/\ndist/\ndist-ssr/\n*.local\n.vite/\ncoverage/" },
    { id: "next", name: "Next.js", group: "Frameworks", rules: "node_modules/\n.next/\nout/\nnext-env.d.ts\n.vercel\n*.tsbuildinfo\n.env*.local" },
    { id: "vue", name: "Vue / Nuxt", group: "Frameworks", rules: "node_modules/\ndist/\n.nuxt/\n.output/\n.nitro/\n.cache/\n*.local" },
    { id: "svelte", name: "SvelteKit", group: "Frameworks", rules: "node_modules/\n.svelte-kit/\nbuild/\n.output/\nvite.config.js.timestamp-*\nvite.config.ts.timestamp-*" },
    { id: "angular", name: "Angular", group: "Frameworks", rules: "node_modules/\ndist/\ntmp/\nout-tsc/\n.angular/cache\n.sass-cache/\ncoverage/" },
    { id: "laravel", name: "Laravel", group: "Frameworks", rules: "/vendor/\n/node_modules/\n/public/build\n/public/hot\n/public/storage\n/storage/*.key\n/storage/pail\n.env\n.env.backup\n.env.production\n.phpunit.result.cache\nHomestead.json\nHomestead.yaml\nauth.json\nnpm-debug.log" },
    { id: "django", name: "Django", group: "Frameworks", rules: "*.log\n*.pot\n*.pyc\n__pycache__/\nlocal_settings.py\ndb.sqlite3\ndb.sqlite3-journal\nmedia/\nstaticfiles/" },
    { id: "rails", name: "Rails", group: "Frameworks", rules: "/.bundle\n/log/*\n/tmp/*\n!/log/.keep\n!/tmp/.keep\n/storage/*\n!/storage/.keep\n/public/assets\n/config/master.key\n/config/credentials/*.key\n/node_modules" },
    { id: "unity", name: "Unity", group: "Frameworks", rules: "/[Ll]ibrary/\n/[Tt]emp/\n/[Oo]bj/\n/[Bb]uild/\n/[Bb]uilds/\n/[Ll]ogs/\n/[Uu]ser[Ss]ettings/\n*.csproj\n*.unityproj\n*.sln\n*.pidb\n*.booproj\n*.apk\n*.unitypackage" },

    { id: "env", name: "Secrets & env files", group: "Tools", rules: ".env\n.env.*\n!.env.example\n*.pem\n*.key\n*.p12\n*.pfx\nsecrets.*\n.secrets/\ncredentials.json" },
    { id: "docker", name: "Docker", group: "Tools", rules: "docker-compose.override.yml\ncompose.override.yaml\n.docker/\n*.pid" },
    { id: "terraform", name: "Terraform", group: "Tools", rules: ".terraform/\n*.tfstate\n*.tfstate.*\ncrash.log\ncrash.*.log\n*.tfvars\n*.tfvars.json\noverride.tf\noverride.tf.json\n*_override.tf\n.terraformrc\nterraform.rc" },
    { id: "logs", name: "Logs & temp files", group: "Tools", rules: "*.log\nlogs/\n*.tmp\n*.temp\n*.bak\n*.swp\n*~\ntmp/\n.cache/" },
    { id: "archives", name: "Archives & dumps", group: "Tools", rules: "*.zip\n*.tar\n*.tar.gz\n*.tgz\n*.rar\n*.7z\n*.sql\n*.sqlite\n*.dump" },
    { id: "ai", name: "AI coding tools", group: "Tools", rules: ".claude/settings.local.json\n.cursor/\n.aider*\n.continue/\n.codeium/" },

    { id: "vscode", name: "VS Code", group: "Editors", rules: ".vscode/*\n!.vscode/settings.json\n!.vscode/tasks.json\n!.vscode/launch.json\n!.vscode/extensions.json\n*.code-workspace\n.history/" },
    { id: "jetbrains", name: "JetBrains IDEs", group: "Editors", rules: ".idea/\n*.iws\n*.iml\n*.ipr\nout/\n.idea_modules/\ncmake-build-*/" },
    { id: "vim", name: "Vim / Emacs", group: "Editors", rules: "[._]*.s[a-v][a-z]\n[._]*.sw[a-p]\nSession.vim\n.netrwhist\ntags\n\\#*\\#\n.\\#*\n*.elc" },

    { id: "macos", name: "macOS", group: "OS", rules: ".DS_Store\n.AppleDouble\n.LSOverride\n._*\n.Spotlight-V100\n.Trashes\n.fseventsd" },
    { id: "windows", name: "Windows", group: "OS", rules: "Thumbs.db\nThumbs.db:encryptable\nehthumbs.db\n[Dd]esktop.ini\n$RECYCLE.BIN/\n*.lnk" },
    { id: "linux", name: "Linux", group: "OS", rules: "*~\n.fuse_hidden*\n.directory\n.Trash-*\n.nfs*" },
];

const groups = ["Languages", "Frameworks", "Tools", "Editors", "OS"] as const;
const selected = ref<string[]>(["node", "env", "vscode", "macos"]);
const query = ref("");
const dedupe = ref(true);
const custom = ref("");

const visible = computed(() => {
    const q = query.value.trim().toLowerCase();
    return groups.map((g) => ({ g, items: T.filter((t) => t.group === g && (!q || t.name.toLowerCase().includes(q) || t.id.includes(q))) })).filter((x) => x.items.length);
});

function toggle(id: string) {
    const i = selected.value.indexOf(id);
    if (i < 0) selected.value.push(id);
    else selected.value.splice(i, 1);
}

const output = computed(() => {
    const seen = new Set<string>();
    const blocks: string[] = [];
    const add = (title: string, rules: string) => {
        const lines = rules.split("\n").map((l) => l.trimEnd()).filter((l) => {
            if (!l || l.startsWith("#") || !dedupe.value) return !!l;
            if (seen.has(l)) return false;
            seen.add(l);
            return true;
        });
        if (lines.some((l) => !l.startsWith("#"))) blocks.push(`# ${title}\n${lines.join("\n")}`);
    };
    for (const t of T) if (selected.value.includes(t.id)) add(t.name, t.rules);
    if (custom.value.trim()) add("Custom", custom.value);
    return blocks.length ? blocks.join("\n\n") + "\n" : "";
});

const ruleCount = computed(() => output.value.split("\n").filter((l) => l && !l.startsWith("#")).length);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Templates">
                    <template #actions><Btn size="sm" variant="ghost" :disabled="!selected.length" @click="selected = []"><X /> Clear</Btn></template>
                    <div class="relative mb-3">
                        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                        <input v-model="query" class="input !pl-9" placeholder="Search languages, frameworks, editors…" aria-label="Search templates" />
                    </div>
                    <div class="flex flex-col gap-3">
                        <div v-for="grp in visible" :key="grp.g">
                            <div class="mb-1.5 text-xs font-medium text-muted uppercase">{{ grp.g }}</div>
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="t in grp.items" :key="t.id" type="button" :aria-pressed="selected.includes(t.id)"
                                    class="cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors"
                                    :class="selected.includes(t.id) ? 'border-accent bg-accent/10 font-medium text-fg' : 'border-line text-muted hover:text-fg'"
                                    @click="toggle(t.id)"
                                >{{ t.name }}</button>
                            </div>
                        </div>
                        <p v-if="!visible.length" class="text-sm text-muted">No template matches "{{ query }}".</p>
                    </div>
                </Panel>
                <Panel title="Custom rules" flush>
                    <CodeArea v-model="custom" height="7rem" placeholder="One pattern per line, e.g.&#10;/uploads&#10;*.local.json" />
                </Panel>
            </div>

            <Panel title=".gitignore" flush>
                <template #actions>
                    <label class="mr-1 flex items-center gap-2 text-xs"><input v-model="dedupe" type="checkbox" class="checkbox" /> Remove duplicates</label>
                    <Btn size="sm" variant="ghost" :disabled="!output" @click="downloadBlob(output, '.gitignore')"><Download /> Download</Btn>
                    <CopyButton :text="output" />
                </template>
                <CodeArea :model-value="output" readonly :wrap="false" height="34rem" placeholder="Pick templates to build your .gitignore" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ selected.length }} template{{ selected.length === 1 ? "" : "s" }} · {{ ruleCount }} rules</div>
            </Panel>
        </div>
    </ToolPage>
</template>
