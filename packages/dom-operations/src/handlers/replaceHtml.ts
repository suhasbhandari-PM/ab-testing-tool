import { ReplaceHtmlOperation } from "../../../shared-types/src";
import { hashContent, isAlreadyApplied, markApplied } from "../idempotency";
import { OperationResult } from "../types";

const IDEMPOTENCY_KEY = "replace";
const FULL_DOCUMENT_RE = /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i;

function nonEmptyNode(node: Node): boolean {
  return node.nodeType !== Node.TEXT_NODE || (node.textContent ?? "").trim().length > 0;
}

function isElementNode(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function parseFullDocument(html: string): Node[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const nodes: Node[] = [];

  // Keep styles declared in <head> so full-document payloads remain styled.
  parsed.head.querySelectorAll("style, link[rel='stylesheet']").forEach((headNode) => {
    nodes.push(headNode.cloneNode(true));
  });

  Array.from(parsed.body.childNodes).filter(nonEmptyNode).forEach((bodyNode) => {
    nodes.push(bodyNode.cloneNode(true));
  });

  return nodes;
}

function parseHtmlFragment(html: string): Node[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  return Array.from(template.content.childNodes).filter(nonEmptyNode);
}

function getReplacementNodes(html: string): Node[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  if (FULL_DOCUMENT_RE.test(trimmed)) {
    return parseFullDocument(trimmed);
  }
  return parseHtmlFragment(trimmed);
}

function getInnerHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || !FULL_DOCUMENT_RE.test(trimmed)) {
    return html;
  }

  const parsed = new DOMParser().parseFromString(trimmed, "text/html");
  const headStyles = Array.from(parsed.head.querySelectorAll("style, link[rel='stylesheet']"))
    .map((node) => node.outerHTML)
    .join("");
  return `${headStyles}${parsed.body.innerHTML}`;
}

export function applyReplaceHtml(op: ReplaceHtmlOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  const contentHash = hashContent(op.html + op.position);
  const attrKey = `${IDEMPOTENCY_KEY}-${contentHash}`;

  if (isAlreadyApplied(el, attrKey)) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  if (op.position === "inner") {
    el.innerHTML = getInnerHtml(op.html);
    markApplied(el, attrKey);
  } else {
    const replacementNodes = getReplacementNodes(op.html);
    if (replacementNodes.length === 0) {
      return {
        status: "failed",
        operationIndex: index,
        type: op.type,
        selector: op.selector,
        reason: "Replacement HTML produced no nodes"
      };
    }

    replacementNodes.filter(isElementNode).forEach((node) => {
      markApplied(node, attrKey);
    });

    el.replaceWith(...replacementNodes);
  }

  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
