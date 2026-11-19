export interface License {
    id: string;
    name: string;
    spdx: string;
    summary: string;
    url: string;
    /** true when `body` is the complete license text */
    full: boolean;
    permissions: string[];
    conditions: string[];
    limitations: string[];
    /** LICENSE file text (placeholders: {{year}} {{holder}} {{project}}) */
    body: string;
    /** Source-file header (without comment markers) */
    header: string;
}

const P_ALL = ["Commercial use", "Modification", "Distribution", "Private use"];
const P_PATENT = [...P_ALL, "Patent use"];
const L_BASIC = ["Liability", "Warranty"];

const mit = `MIT License

Copyright (c) {{year}} {{holder}}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const bsdTail = `THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`;

const bsd2 = `BSD 2-Clause License

Copyright (c) {{year}}, {{holder}}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

${bsdTail}`;

const bsd3 = `BSD 3-Clause License

Copyright (c) {{year}}, {{holder}}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

${bsdTail}`;

const isc = `ISC License

Copyright (c) {{year}}, {{holder}}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
`;

const unlicense = `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
`;

const apacheNotice = `{{project}}
Copyright {{year}} {{holder}}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`;

function gnu(name: string, short: string, url: string, v = "3") {
    const what = short === "AGPL" ? "program" : short === "LGPL" ? "library" : "program";
    return `{{project}}
Copyright (C) {{year}} {{holder}}

This ${what} is free software: you can redistribute it and/or modify
it under the terms of the GNU ${name} as published by
the Free Software Foundation, either version ${v} of the License, or
(at your option) any later version.

This ${what} is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU ${name} for more details.

You should have received a copy of the GNU ${name}
along with this ${what}.  If not, see <${url}>.`;
}

const gpl = gnu("General Public License", "GPL", "https://www.gnu.org/licenses/");
const lgpl = gnu("Lesser General Public License", "LGPL", "https://www.gnu.org/licenses/");
const agpl = gnu("Affero General Public License", "AGPL", "https://www.gnu.org/licenses/");

const mpl = `This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.`;

const cc0 = `CC0 1.0 Universal (Public Domain Dedication)

To the extent possible under law, {{holder}} has waived all copyright and
related or neighboring rights to {{project}}. This work is published from
the world-wide public domain.

You can copy, modify, distribute and perform the work, even for commercial
purposes, all without asking permission.

This is a summary. See the full legal code at
https://creativecommons.org/publicdomain/zero/1.0/legalcode
`;

function notice(text: string, url: string, title: string) {
    return `${text}\n\n---\nThis file contains the standard notice only. The full text of the ${title} is available at:\n${url}\nInclude the complete license text in your repository before distributing.\n`;
}

const simpleHeader = (spdx: string) => `Copyright (c) {{year}} {{holder}}\n\nSPDX-License-Identifier: ${spdx}`;

export const licenses: License[] = [
    {
        id: "MIT",
        name: "MIT License",
        spdx: "MIT",
        summary: "A short, permissive license with only conditions to preserve copyright and license notices.",
        url: "https://opensource.org/license/mit",
        full: true,
        permissions: P_ALL,
        conditions: ["License and copyright notice"],
        limitations: L_BASIC,
        body: mit,
        header: simpleHeader("MIT"),
    },
    {
        id: "Apache-2.0",
        name: "Apache License 2.0",
        spdx: "Apache-2.0",
        summary: "Permissive license with an express patent grant. Changes must be stated.",
        url: "https://www.apache.org/licenses/LICENSE-2.0.txt",
        full: false,
        permissions: P_PATENT,
        conditions: ["License and copyright notice", "State changes"],
        limitations: ["Trademark use", ...L_BASIC],
        body: notice(apacheNotice, "https://www.apache.org/licenses/LICENSE-2.0.txt", "Apache License, Version 2.0"),
        header: `${apacheNotice}\n\nSPDX-License-Identifier: Apache-2.0`,
    },
    {
        id: "GPL-3.0",
        name: "GNU GPL v3.0",
        spdx: "GPL-3.0-or-later",
        summary: "Strong copyleft. Derivative works must be distributed under the same license with source.",
        url: "https://www.gnu.org/licenses/gpl-3.0.txt",
        full: false,
        permissions: P_PATENT,
        conditions: ["Disclose source", "License and copyright notice", "Same license", "State changes"],
        limitations: L_BASIC,
        body: notice(gpl, "https://www.gnu.org/licenses/gpl-3.0.txt", "GNU General Public License v3.0"),
        header: `${gpl}\n\nSPDX-License-Identifier: GPL-3.0-or-later`,
    },
    {
        id: "LGPL-3.0",
        name: "GNU LGPL v3.0",
        spdx: "LGPL-3.0-or-later",
        summary: "Weak copyleft for libraries. Linking from non-free software is allowed.",
        url: "https://www.gnu.org/licenses/lgpl-3.0.txt",
        full: false,
        permissions: P_PATENT,
        conditions: ["Disclose source", "License and copyright notice", "Same license (library)", "State changes"],
        limitations: L_BASIC,
        body: notice(lgpl, "https://www.gnu.org/licenses/lgpl-3.0.txt", "GNU Lesser General Public License v3.0"),
        header: `${lgpl}\n\nSPDX-License-Identifier: LGPL-3.0-or-later`,
    },
    {
        id: "AGPL-3.0",
        name: "GNU AGPL v3.0",
        spdx: "AGPL-3.0-or-later",
        summary: "Like GPL-3.0, and network use counts as distribution so hosted modifications must share source.",
        url: "https://www.gnu.org/licenses/agpl-3.0.txt",
        full: false,
        permissions: P_PATENT,
        conditions: ["Disclose source", "License and copyright notice", "Network use is distribution", "Same license", "State changes"],
        limitations: L_BASIC,
        body: notice(agpl, "https://www.gnu.org/licenses/agpl-3.0.txt", "GNU Affero General Public License v3.0"),
        header: `${agpl}\n\nSPDX-License-Identifier: AGPL-3.0-or-later`,
    },
    {
        id: "MPL-2.0",
        name: "Mozilla Public License 2.0",
        spdx: "MPL-2.0",
        summary: "File-level copyleft. Modified files stay MPL, but they may be combined with other code.",
        url: "https://www.mozilla.org/media/MPL/2.0/index.txt",
        full: false,
        permissions: P_PATENT,
        conditions: ["Disclose source", "License and copyright notice", "Same license (file)"],
        limitations: ["Trademark use", ...L_BASIC],
        body: notice(`Copyright (c) {{year}} {{holder}}\n\n${mpl}`, "https://www.mozilla.org/media/MPL/2.0/index.txt", "Mozilla Public License 2.0"),
        header: `${mpl}\n\nSPDX-License-Identifier: MPL-2.0`,
    },
    {
        id: "BSD-2-Clause",
        name: 'BSD 2-Clause "Simplified"',
        spdx: "BSD-2-Clause",
        summary: "Permissive license requiring that source and binary redistributions keep the notice.",
        url: "https://opensource.org/license/bsd-2-clause",
        full: true,
        permissions: P_ALL,
        conditions: ["License and copyright notice"],
        limitations: L_BASIC,
        body: bsd2,
        header: simpleHeader("BSD-2-Clause"),
    },
    {
        id: "BSD-3-Clause",
        name: 'BSD 3-Clause "New"',
        spdx: "BSD-3-Clause",
        summary: "Like BSD 2-Clause, plus a ban on using contributor names for endorsement.",
        url: "https://opensource.org/license/bsd-3-clause",
        full: true,
        permissions: P_ALL,
        conditions: ["License and copyright notice"],
        limitations: L_BASIC,
        body: bsd3,
        header: simpleHeader("BSD-3-Clause"),
    },
    {
        id: "ISC",
        name: "ISC License",
        spdx: "ISC",
        summary: "Functionally equivalent to MIT / BSD-2-Clause with simplified wording.",
        url: "https://opensource.org/license/isc-license-txt",
        full: true,
        permissions: P_ALL,
        conditions: ["License and copyright notice"],
        limitations: L_BASIC,
        body: isc,
        header: simpleHeader("ISC"),
    },
    {
        id: "Unlicense",
        name: "The Unlicense",
        spdx: "Unlicense",
        summary: "Dedicates the work to the public domain with no conditions.",
        url: "https://unlicense.org/",
        full: true,
        permissions: P_ALL,
        conditions: [],
        limitations: L_BASIC,
        body: unlicense,
        header: "This is free and unencumbered software released into the public domain.\nFor more information, see <https://unlicense.org>\n\nSPDX-License-Identifier: Unlicense",
    },
    {
        id: "CC0-1.0",
        name: "Creative Commons Zero v1.0",
        spdx: "CC0-1.0",
        summary: "Waives all copyright and related rights as far as the law allows. Patent and trademark rights are not granted.",
        url: "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
        full: false,
        permissions: P_ALL,
        conditions: [],
        limitations: ["Liability", "Trademark use", "Patent use", "Warranty"],
        body: cc0,
        header: "Written in {{year}} by {{holder}}\nTo the extent possible under law, the author(s) have dedicated all copyright\nand related rights to this software to the public domain worldwide.\n\nSPDX-License-Identifier: CC0-1.0",
    },
];

export function fillTemplate(tpl: string, vars: { year: string; holder: string; project: string }) {
    const holder = vars.holder.trim() || "<copyright holder>";
    const project = vars.project.trim();
    return tpl
        .replace(/\{\{project\}\}\n?/g, project ? `${project}\n` : "")
        .replace(/\{\{year\}\}/g, vars.year.trim() || String(new Date().getFullYear()))
        .replace(/\{\{holder\}\}/g, holder)
        .replace(/^\n+/, "");
}
