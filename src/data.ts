import { ref } from "vue";
import type { Tool } from "./components";

export const tools = ref<Tool[]>([
    {
        id: "1",
        name: "JSON Formatter",
        description:
            "A powerful JSON formatter and validator that helps you format, validate, and prettify JSON data with syntax highlighting and error detection.",
        visitLink: "/json-formatter",
    },
    {
        id: "2",
        name: "Color Palette Generator",
        description:
            "Generate beautiful color palettes for your design projects with various harmony rules, accessibility checks, and export options.",
        visitLink: "/color-palette-generator",
    },
    {
        id: "3",
        name: "Base64 Encoder/Decoder",
        description:
            "Encode and decode Base64 strings quickly and easily. Perfect for developers working with data encoding and API integrations.",
        visitLink: "/base64-encoder",
    },
    {
        id: "4",
        name: "URL Shortener",
        description:
            "Create short, memorable URLs for your links with detailed analytics, custom domains, and expiration settings.",
        visitLink: "/url-shortener",
    },
    {
        id: "5",
        name: "QR Code Generator",
        description:
            "Generate QR codes for URLs, text, WiFi credentials, and more with customizable colors, sizes, and download formats.",
        visitLink: "/qr-code-generator",
    },
    {
        id: "6",
        name: "Password Generator",
        description:
            "Create strong, secure passwords with customizable length, character sets, and complexity requirements for enhanced security.",
        visitLink: "/password-generator",
    },
]);
