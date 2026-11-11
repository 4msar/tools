<script setup lang="ts">
import { computed, reactive } from "vue";
import { Download } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

type Server = "nginx" | "apache" | "caddy";
type Kind = "static" | "spa" | "php" | "proxy";

const o = reactive({
    server: "nginx" as Server,
    kind: "static" as Kind,
    domain: "example.com",
    www: "redirect" as "none" | "alias" | "redirect",
    root: "/var/www/example.com/public",
    upstream: "http://127.0.0.1:3000",
    websockets: true,
    phpVersion: "8.3",
    laravel: true,
    https: true,
    certs: "letsencrypt" as "letsencrypt" | "custom",
    certPath: "/etc/ssl/certs/example.com.pem",
    keyPath: "/etc/ssl/private/example.com.key",
    hsts: false,
    http2: true,
    compression: true,
    cacheAssets: true,
    securityHeaders: true,
    maxBody: 20,
    logs: true,
});

const kinds: { value: Kind; label: string }[] = [
    { value: "static", label: "Static site" }, { value: "spa", label: "Single-page app" },
    { value: "php", label: "PHP (FPM)" }, { value: "proxy", label: "Reverse proxy" },
];

const domain = computed(() => o.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || "example.com");
const www = computed(() => `www.${domain.value}`);
const domainError = computed(() => (/^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$|^localhost$/.test(domain.value) ? "" : "That does not look like a valid domain name."));
const upstream = computed(() => {
    const u = o.upstream.trim() || "http://127.0.0.1:3000";
    return (/^[a-z]+:\/\//i.test(u) ? u : `http://${u}`).replace(/\/+$/, "");
});
const root = computed(() => o.root.trim() || "/var/www/html");
const cert = computed(() => (o.certs === "letsencrypt" ? `/etc/letsencrypt/live/${domain.value}/fullchain.pem` : o.certPath.trim()));
const key = computed(() => (o.certs === "letsencrypt" ? `/etc/letsencrypt/live/${domain.value}/privkey.pem` : o.keyPath.trim()));
const usesRoot = computed(() => o.kind !== "proxy");

const HEADERS: [string, string][] = [
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "SAMEORIGIN"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
];
const HSTS = "max-age=31536000; includeSubDomains";
const ASSETS = "css|js|mjs|jpg|jpeg|png|gif|webp|avif|svg|ico|woff|woff2|ttf";

// ---------- nginx ----------
function nginx(): string {
    const d = domain.value;
    const names = o.www === "alias" ? `${d} ${www.value}` : d;
    const ind = (lines: string[], n = 1) => lines.map((l) => (l ? "    ".repeat(n) + l : ""));
    const listen = (ssl: boolean) =>
        ssl ? ["listen 443 ssl;", "listen [::]:443 ssl;", ...(o.http2 ? ["http2 on;"] : [])] : ["listen 80;", "listen [::]:80;"];
    const ssl = [`ssl_certificate     ${cert.value};`, `ssl_certificate_key ${key.value};`, "ssl_protocols       TLSv1.2 TLSv1.3;"];
    const blocks: string[] = [];

    if (o.https) {
        const all = o.www === "none" ? d : `${d} ${www.value}`;
        blocks.push(["# Redirect HTTP to HTTPS", "server {", ...ind([...listen(false), `server_name ${all};`, "", `return 301 https://${o.www === "alias" ? "$host" : d}$request_uri;`]), "}"].join("\n"));
    }
    if (o.www === "redirect") {
        blocks.push(["# Redirect www to the bare domain", "server {", ...ind([...listen(o.https), `server_name ${www.value};`, ...(o.https ? ["", ...ssl] : []), "", `return 301 ${o.https ? "https" : "http"}://${d}$request_uri;`]), "}"].join("\n"));
    }

    const body: string[] = [...listen(o.https), `server_name ${names};`];
    if (o.https) body.push("", ...ssl);
    if (usesRoot.value) body.push("", `root ${root.value};`, `index ${o.kind === "php" ? "index.php index.html" : "index.html"};`);
    if (o.maxBody) body.push("", `client_max_body_size ${o.maxBody}m;`);
    if (o.logs) body.push("", `access_log /var/log/nginx/${d}.access.log;`, `error_log  /var/log/nginx/${d}.error.log;`);
    if (o.securityHeaders || (o.https && o.hsts)) {
        body.push("");
        if (o.securityHeaders) for (const [k, v] of HEADERS) body.push(`add_header ${k} "${v}" always;`);
        if (o.https && o.hsts) body.push(`add_header Strict-Transport-Security "${HSTS}" always;`);
    }
    if (o.compression) body.push("", "gzip on;", "gzip_vary on;", "gzip_min_length 1024;", "gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;");

    body.push("");
    if (o.kind === "static") body.push("location / {", "    try_files $uri $uri/ =404;", "}");
    else if (o.kind === "spa") body.push("# Unknown paths fall back to index.html so client-side routing works", "location / {", "    try_files $uri $uri/ /index.html;", "}");
    else if (o.kind === "php") {
        body.push(
            "location / {", `    try_files $uri $uri/ ${o.laravel ? "/index.php?$query_string" : "=404"};`, "}", "",
            "location ~ \\.php$ {", "    include snippets/fastcgi-php.conf;", `    fastcgi_pass unix:/run/php/php${o.phpVersion}-fpm.sock;`, "}", "",
            "location ~ /\\.(?!well-known) {", "    deny all;", "}",
        );
    } else {
        body.push(
            "location / {", `    proxy_pass ${upstream.value};`, "    proxy_http_version 1.1;",
            "    proxy_set_header Host $host;", "    proxy_set_header X-Real-IP $remote_addr;",
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;", "    proxy_set_header X-Forwarded-Proto $scheme;",
            ...(o.websockets ? ["    proxy_set_header Upgrade $http_upgrade;", '    proxy_set_header Connection "upgrade";', "    proxy_read_timeout 300s;"] : []),
            "}",
        );
    }
    if (o.cacheAssets && usesRoot.value) body.push("", `location ~* \\.(${ASSETS})$ {`, "    expires 30d;", '    add_header Cache-Control "public, immutable";', "    access_log off;", "}");

    blocks.push(["server {", ...ind(body), "}"].join("\n"));
    return blocks.join("\n\n") + "\n";
}

// ---------- Apache ----------
function apache(): string {
    const d = domain.value;
    const ind = (lines: string[]) => lines.map((l) => (l ? "    " + l : ""));
    const scheme = o.https ? "https" : "http";
    const blocks: string[] = [];
    const sslLines = ["SSLEngine on", `SSLCertificateFile ${cert.value}`, `SSLCertificateKeyFile ${key.value}`];

    if (o.https) {
        blocks.push(["# Redirect HTTP to HTTPS", "<VirtualHost *:80>", ...ind([`ServerName ${d}`, ...(o.www !== "none" ? [`ServerAlias ${www.value}`] : []), `Redirect permanent / https://${d}/`]), "</VirtualHost>"].join("\n"));
    }
    if (o.www === "redirect") {
        blocks.push(["# Redirect www to the bare domain", `<VirtualHost *:${o.https ? 443 : 80}>`, ...ind([`ServerName ${www.value}`, ...(o.https ? sslLines : []), `Redirect permanent / ${scheme}://${d}/`]), "</VirtualHost>"].join("\n"));
    }

    const body: string[] = [`ServerName ${d}`];
    if (o.www === "alias") body.push(`ServerAlias ${www.value}`);
    if (o.https) body.push("", ...sslLines, ...(o.http2 ? ["Protocols h2 http/1.1"] : []));
    if (o.maxBody) body.push("", `LimitRequestBody ${o.maxBody * 1024 * 1024}`);
    if (o.logs) body.push("", `ErrorLog \${APACHE_LOG_DIR}/${d}.error.log`, `CustomLog \${APACHE_LOG_DIR}/${d}.access.log combined`);
    if (o.securityHeaders || (o.https && o.hsts)) {
        body.push("");
        if (o.securityHeaders) for (const [k, v] of HEADERS) body.push(`Header always set ${k} "${v}"`);
        if (o.https && o.hsts) body.push(`Header always set Strict-Transport-Security "${HSTS}"`);
    }
    if (o.compression) body.push("", "AddOutputFilterByType DEFLATE text/plain text/html text/css application/json application/javascript application/xml image/svg+xml");

    if (o.kind === "proxy") {
        body.push("", "ProxyPreserveHost On", `RequestHeader set X-Forwarded-Proto "${scheme}"`);
        if (o.websockets) {
            const ws = upstream.value.replace(/^http/, "ws");
            body.push("", "RewriteEngine On", "RewriteCond %{HTTP:Upgrade} =websocket [NC]", `RewriteRule ^/(.*)$ ${ws}/$1 [P,L]`);
        }
        body.push("", `ProxyPass / ${upstream.value}/`, `ProxyPassReverse / ${upstream.value}/`);
    } else {
        body.push("", `DocumentRoot ${root.value}`, "", `<Directory ${root.value}>`, "    Options -Indexes +FollowSymLinks", `    AllowOverride ${o.kind === "php" ? "All" : "None"}`, "    Require all granted");
        if (o.kind === "spa") body.push("", "    # Unknown paths fall back to index.html so client-side routing works", "    FallbackResource /index.html");
        if (o.kind === "php" && o.laravel) body.push("", "    FallbackResource /index.php");
        body.push("</Directory>");
        if (o.kind === "php") body.push("", "<FilesMatch \\.php$>", `    SetHandler "proxy:unix:/run/php/php${o.phpVersion}-fpm.sock|fcgi://localhost"`, "</FilesMatch>");
        if (o.cacheAssets) body.push("", `<FilesMatch "\\.(${ASSETS})$">`, '    Header set Cache-Control "public, max-age=2592000, immutable"', "</FilesMatch>");
    }

    blocks.push([`<VirtualHost *:${o.https ? 443 : 80}>`, ...ind(body), "</VirtualHost>"].join("\n"));
    return blocks.join("\n\n") + "\n";
}

// ---------- Caddy ----------
function caddy(): string {
    const d = domain.value;
    const site = (name: string) => (o.https ? name : `http://${name}`);
    const blocks: string[] = [];
    if (o.www === "redirect") blocks.push([`${site(www.value)} {`, ...(o.https && o.certs === "custom" ? [`    tls ${cert.value} ${key.value}`] : []), `    redir ${o.https ? "https" : "http"}://${d}{uri} permanent`, "}"].join("\n"));

    const body: string[] = [];
    if (o.https && o.certs === "custom") body.push(`tls ${cert.value} ${key.value}`, "");
    if (usesRoot.value) body.push(`root * ${root.value}`);
    if (o.compression) body.push("encode zstd gzip");
    if (o.maxBody) body.push("", "request_body {", `    max_size ${o.maxBody}MB`, "}");
    if (o.securityHeaders || (o.https && o.hsts)) {
        body.push("", "header {");
        if (o.securityHeaders) for (const [k, v] of HEADERS) body.push(`    ${k} "${v}"`);
        if (o.https && o.hsts) body.push(`    Strict-Transport-Security "${HSTS}"`);
        body.push("}");
    }
    if (o.cacheAssets && usesRoot.value) body.push("", `@assets path *.${ASSETS.split("|").join(" *.")}`, 'header @assets Cache-Control "public, max-age=2592000, immutable"');
    if (o.logs) body.push("", "log {", `    output file /var/log/caddy/${d}.access.log`, "}");

    body.push("");
    if (o.kind === "static") body.push("file_server");
    else if (o.kind === "spa") body.push("# Unknown paths fall back to index.html so client-side routing works", "try_files {path} /index.html", "file_server");
    else if (o.kind === "php") body.push(`php_fastcgi unix//run/php/php${o.phpVersion}-fpm.sock`, "file_server");
    else body.push(`reverse_proxy ${upstream.value.replace(/^http:\/\//, "")}`);

    const names = o.www === "alias" ? `${site(d)}, ${site(www.value)}` : site(d);
    blocks.push([`${names} {`, ...body.map((l) => (l ? "    " + l : "")), "}"].join("\n").replace(/\{\n\n/g, "{\n"));
    return blocks.join("\n\n") + "\n";
}

const config = computed(() => (o.server === "nginx" ? nginx() : o.server === "apache" ? apache() : caddy()));
const fileName = computed(() => (o.server === "nginx" ? domain.value : o.server === "apache" ? `${domain.value}.conf` : "Caddyfile"));

const steps = computed(() => {
    const d = domain.value;
    if (o.server === "nginx") {
        return [
            `sudo nano /etc/nginx/sites-available/${d}`,
            `sudo ln -s /etc/nginx/sites-available/${d} /etc/nginx/sites-enabled/`,
            ...(o.https && o.certs === "letsencrypt" ? [`sudo certbot certonly --nginx -d ${d}${o.www !== "none" ? ` -d ${www.value}` : ""}`] : []),
            "sudo nginx -t && sudo systemctl reload nginx",
        ];
    }
    if (o.server === "apache") {
        const mods = ["headers", ...(o.https ? ["ssl"] : []), ...(o.https && o.http2 ? ["http2"] : []), ...(o.kind === "proxy" ? ["proxy", "proxy_http", ...(o.websockets ? ["proxy_wstunnel", "rewrite"] : [])] : []), ...(o.kind === "php" ? ["proxy_fcgi", "setenvif"] : []), ...(o.compression ? ["deflate"] : [])];
        return [
            `sudo nano /etc/apache2/sites-available/${d}.conf`,
            `sudo a2enmod ${mods.join(" ")}`,
            `sudo a2ensite ${d}.conf`,
            ...(o.https && o.certs === "letsencrypt" ? [`sudo certbot certonly --apache -d ${d}${o.www !== "none" ? ` -d ${www.value}` : ""}`] : []),
            "sudo apachectl configtest && sudo systemctl reload apache2",
        ];
    }
    return ["sudo nano /etc/caddy/Caddyfile", "caddy validate --config /etc/caddy/Caddyfile", "sudo systemctl reload caddy"];
});

const notes = computed(() => {
    const n: string[] = [];
    if (o.server === "caddy" && o.https && o.certs === "letsencrypt") n.push("Caddy gets and renews the HTTPS certificate by itself and redirects HTTP to HTTPS, so no certificate lines are needed.");
    if (o.server === "caddy" && o.kind === "php") n.push("php_fastcgi already routes unknown paths to index.php, which is what Laravel and most frameworks need.");
    if (o.server !== "caddy" && o.https && o.certs === "letsencrypt") n.push("The certificate files must exist before the server will start. Run the certbot step first, or get the certificate with a temporary HTTP-only config.");
    if (o.server === "nginx" && o.http2) n.push("`http2 on;` needs nginx 1.25.1 or newer. On older versions remove it and use `listen 443 ssl http2;` instead.");
    if (o.server === "nginx" && o.kind === "php") n.push("`snippets/fastcgi-php.conf` ships with Debian and Ubuntu. On other systems use `include fastcgi_params;` and set SCRIPT_FILENAME yourself.");
    if (o.server === "apache" && o.kind === "php") n.push("AllowOverride All lets a .htaccess file in the document root add rewrite rules.");
    if (o.https && o.hsts) n.push("HSTS tells browsers to refuse plain HTTP for a year, including subdomains. Only enable it once HTTPS works everywhere.");
    return n;
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="o.server" :options="[{ value: 'nginx', label: 'Nginx' }, { value: 'apache', label: 'Apache' }, { value: 'caddy', label: 'Caddy' }]" />
        </template>

        <div class="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Site">
                    <div class="flex flex-col gap-3">
                        <Field label="Domain">
                            <input v-model="o.domain" class="input font-mono" spellcheck="false" placeholder="example.com" />
                        </Field>
                        <Notice v-if="domainError" type="warning">{{ domainError }}</Notice>
                        <Field label="www subdomain">
                            <select v-model="o.www" class="select">
                                <option value="redirect">Redirect www to {{ domain }}</option>
                                <option value="alias">Serve the site on both</option>
                                <option value="none">Do not handle www</option>
                            </select>
                        </Field>
                        <Field label="Serves">
                            <select v-model="o.kind" class="select"><option v-for="k in kinds" :key="k.value" :value="k.value">{{ k.label }}</option></select>
                        </Field>
                        <Field v-if="usesRoot" label="Document root" :hint="o.kind === 'php' && o.laravel ? 'For Laravel this is the project\'s public folder' : ''">
                            <input v-model="o.root" class="input font-mono" spellcheck="false" />
                        </Field>
                        <template v-if="o.kind === 'proxy'">
                            <Field label="Proxy to" hint="The app the server forwards requests to">
                                <input v-model="o.upstream" class="input font-mono" spellcheck="false" placeholder="http://127.0.0.1:3000" />
                            </Field>
                            <label v-if="o.server !== 'caddy'" class="flex items-center gap-2 text-sm"><input v-model="o.websockets" type="checkbox" class="checkbox" /> Support WebSockets</label>
                        </template>
                        <template v-if="o.kind === 'php'">
                            <Field label="PHP-FPM version">
                                <select v-model="o.phpVersion" class="select"><option v-for="v in ['8.4', '8.3', '8.2', '8.1', '7.4']" :key="v">{{ v }}</option></select>
                            </Field>
                            <label v-if="o.server !== 'caddy'" class="flex items-center gap-2 text-sm"><input v-model="o.laravel" type="checkbox" class="checkbox" /> Front controller (Laravel, Symfony, WordPress)</label>
                        </template>
                    </div>
                </Panel>

                <Panel title="HTTPS">
                    <div class="flex flex-col gap-3">
                        <label class="flex items-center gap-2 text-sm"><input v-model="o.https" type="checkbox" class="checkbox" /> Serve over HTTPS and redirect HTTP</label>
                        <template v-if="o.https">
                            <Field label="Certificate">
                                <select v-model="o.certs" class="select">
                                    <option value="letsencrypt">{{ o.server === "caddy" ? "Automatic (Let's Encrypt)" : "Let's Encrypt (certbot paths)" }}</option>
                                    <option value="custom">My own certificate files</option>
                                </select>
                            </Field>
                            <template v-if="o.certs === 'custom'">
                                <Field label="Certificate file"><input v-model="o.certPath" class="input font-mono" spellcheck="false" /></Field>
                                <Field label="Private key file"><input v-model="o.keyPath" class="input font-mono" spellcheck="false" /></Field>
                            </template>
                            <label v-if="o.server !== 'caddy'" class="flex items-center gap-2 text-sm"><input v-model="o.http2" type="checkbox" class="checkbox" /> HTTP/2</label>
                            <label class="flex items-center gap-2 text-sm"><input v-model="o.hsts" type="checkbox" class="checkbox" /> HSTS header</label>
                        </template>
                    </div>
                </Panel>

                <Panel title="Options">
                    <div class="flex flex-col gap-2.5 text-sm">
                        <label class="flex items-center gap-2"><input v-model="o.compression" type="checkbox" class="checkbox" /> Compress responses</label>
                        <label v-if="usesRoot" class="flex items-center gap-2"><input v-model="o.cacheAssets" type="checkbox" class="checkbox" /> Cache static assets for 30 days</label>
                        <label class="flex items-center gap-2"><input v-model="o.securityHeaders" type="checkbox" class="checkbox" /> Basic security headers</label>
                        <label class="flex items-center gap-2"><input v-model="o.logs" type="checkbox" class="checkbox" /> Per-site log files</label>
                        <Field label="Max upload size (MB)" hint="0 keeps the server default" class="mt-1">
                            <input v-model.number="o.maxBody" type="number" min="0" class="input" />
                        </Field>
                    </div>
                </Panel>
            </div>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel :title="fileName" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="downloadBlob(config, fileName)"><Download /> Download</Btn>
                        <CopyButton :text="config" />
                    </template>
                    <CodeArea :model-value="config" readonly :wrap="false" height="34rem" />
                </Panel>

                <Panel title="Install it" flush>
                    <ol class="divide-y divide-line">
                        <li v-for="(s, i) in steps" :key="s" class="flex items-center gap-3 px-4 py-2">
                            <span class="w-4 shrink-0 text-xs text-muted tabular-nums">{{ i + 1 }}</span>
                            <code class="min-w-0 flex-1 font-mono text-[13px] break-all">{{ s }}</code>
                            <CopyButton :text="s" icon-only />
                        </li>
                    </ol>
                </Panel>

                <Notice v-if="notes.length" type="info">
                    <ul class="list-inside list-disc space-y-1"><li v-for="n in notes" :key="n">{{ n }}</li></ul>
                </Notice>
            </div>
        </div>
        <p class="text-xs text-muted">Paths follow Debian and Ubuntu defaults. Treat the output as a starting point and test it (<code class="code">nginx -t</code>, <code class="code">apachectl configtest</code>, <code class="code">caddy validate</code>) before reloading a live server.</p>
    </ToolPage>
</template>
