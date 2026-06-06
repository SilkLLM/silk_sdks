from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="silkllm",  # change to a free name
    version="1.0.0",
    packages=find_packages(),
    package_data={"silkllm": ["py.typed"]},
    install_requires=["httpx>=0.27.0"],
    author="SilkLLM",
    author_email="support@getsilkllm.com",
    description="One unified API for OpenAI, Anthropic, Google, DeepSeek, and xAI with simple fiat billing.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://getsilkllm.com",
    project_urls={
        "Documentation": "https://getsilkllm.com/docs",
        "Source": "https://github.com/SilkLLM/silk_sdks",
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.9",
)