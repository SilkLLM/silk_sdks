"""
multimodal-content-pipeline/pipeline.py

Turns a one-line topic into a scene description (text), an image, and a
short video, through one SilkLLM key. See README.md for the shape of this
pipeline and what each step is doing.

Usage:
    python pipeline.py "a lantern floating over a quiet harbor at dusk"
"""

import sys

import silkllm


def plan_scene(client: silkllm.Client, topic: str) -> str:
    """Turn a short topic into a detailed, visual scene description an image
    or video model can actually work with."""
    res = client.generate(
        messages=[
            {
                "role": "system",
                "content": (
                    "You write single-paragraph visual scene descriptions for "
                    "image and video generation models. Be concrete: lighting, "
                    "color, composition, mood. No preamble, no explanation - "
                    "just the description."
                ),
            },
            {"role": "user", "content": topic},
        ],
        model="gpt-4o",
        max_tokens=200,
    )
    return res.content.strip()


def main() -> None:
    topic = sys.argv[1] if len(sys.argv) > 1 else "a lantern floating over a quiet harbor at dusk"
    client = silkllm.Client()
    total_cost = 0.0

    print(f"Topic: {topic}\n")

    print("1/3  Planning the scene (client.generate)...")
    scene = plan_scene(client, topic)
    print(f"     {scene}\n")

    print("2/3  Rendering the image (client.generate_image)...")
    image = client.generate_image(prompt=scene, model="dall-e-3", n=1)
    total_cost += image.cost_usd
    print(f"     {image.count} image(s), ${image.cost_usd:.4f}")
    for url in image.images:
        print(f"     {url}")
    print()

    print("3/3  Animating a short clip (client.generate_video)...")
    try:
        video = client.generate_video(prompt=scene, seconds=5)
        total_cost += video.cost_usd
        print(f"     {video.video_url}  (${video.cost_usd:.4f})\n")
    except silkllm.ModelNotFoundError:
        # Video generation depends on a provider that supports it being
        # enabled on this account - see client.models() for what's live.
        print("     No video-capable model is enabled on this account right now.\n")

    print(f"Total: ${total_cost:.4f} across all three steps, one balance.")


if __name__ == "__main__":
    main()
