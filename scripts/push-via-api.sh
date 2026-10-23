#!/bin/bash
# 通过 GitHub Git Data API 上传仓库内容（git push 经本机代理会 502，gh API 可用）
set -euo pipefail

REPO="${POLY_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)}"
if [ -z "$REPO" ]; then
  echo "无法确定目标仓库，请设置 POLY_REPO=owner/name" >&2
  exit 1
fi
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 0/4 确保仓库非空（空仓库不允许创建 blob）"
if ! gh api "/repos/$REPO/git/refs/heads/main" --jq .object.sha > "$WORK/head.txt" 2>/dev/null; then
  b64="$(base64 < README.md | tr -d '\n')"
  jq -n --arg c "$b64" --arg m "chore: 初始化仓库" \
    '{message:$m, content:$c, encoding:"base64", branch:"main"}' > "$WORK/seed.json"
  gh api --method PUT "/repos/$REPO/contents/README.md" --input "$WORK/seed.json" --jq .commit.sha
  sleep 1
fi

echo "==> 1/4 上传 blob"
: > "$WORK/blobs.tsv"
while IFS= read -r -d '' f; do
  b64="$(base64 < "$f" | tr -d '\n')"
  jq -n --arg c "$b64" '{content:$c, encoding:"base64"}' > "$WORK/body.json"
  sha="$(gh api --method POST "/repos/$REPO/git/blobs" --input "$WORK/body.json" --jq .sha)"
  printf '%s\t%s\n' "$sha" "$f" >> "$WORK/blobs.tsv"
  echo "    $f"
done < <(git ls-files -z)

echo "==> 2/4 创建 tree"
jq -Rn '[inputs | split("\t") | {path: .[1], mode: "100644", type: "blob", sha: .[0]}]' \
  < "$WORK/blobs.tsv" > "$WORK/tree_entries.json"
jq -n --slurpfile t "$WORK/tree_entries.json" '{tree: $t[0]}' > "$WORK/tree_body.json"
TREE_SHA="$(gh api --method POST "/repos/$REPO/git/trees" --input "$WORK/tree_body.json" --jq .sha)"
echo "    tree=$TREE_SHA"

echo "==> 3/4 创建 commit"
PARENTS="[]"
if gh api "/repos/$REPO/git/refs/heads/main" --jq .object.sha > "$WORK/head.txt" 2>/dev/null; then
  PARENTS="[\"$(cat "$WORK/head.txt")\"]"
fi
# 提交信息默认取本地 HEAD 的完整 message，可用 POLY_COMMIT_MSG 覆盖
MSG="${POLY_COMMIT_MSG:-$(git log -1 --pretty=%B)}"
jq -n --arg tree "$TREE_SHA" --argjson parents "$PARENTS" --arg msg "$MSG" \
  '{message:$msg, tree:$tree, parents:$parents}' > "$WORK/commit_body.json"
COMMIT_SHA="$(gh api --method POST "/repos/$REPO/git/commits" --input "$WORK/commit_body.json" --jq .sha)"
echo "    commit=$COMMIT_SHA"

echo "==> 4/4 更新 main 引用"
if [ "$PARENTS" = "[]" ]; then
  jq -n --arg sha "$COMMIT_SHA" '{ref:"refs/heads/main", sha:$sha}' > "$WORK/ref_body.json"
  gh api --method POST "/repos/$REPO/git/refs" --input "$WORK/ref_body.json" --jq .ref
else
  jq -n --arg sha "$COMMIT_SHA" '{sha:$sha, force:false}' > "$WORK/ref_body.json"
  gh api --method PATCH "/repos/$REPO/git/refs/heads/main" --input "$WORK/ref_body.json" --jq .ref
fi

echo "完成。"
