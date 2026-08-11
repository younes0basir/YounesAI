Overview
Description:
Flux.2 [klein] 4B is the fastest Black Forest Labs image model to date. FLUX.2 [klein] unifies generation and editing in a single compact architecture, delivering state-of-the-art quality with end-to-end inference in as low as under a second. FLUX.2 [klein] 4B is a 4 billion parameter rectified flow transformer capable of generating images from text descriptions and supports multi-reference editing capabilities.

Flux.2 [klein] 4B was developed by Black Forest Labs. This model is ready for commercial/non-commercial use.

Third-Party Community Consideration:
This model is not owned or developed by NVIDIA. This model has been developed and built to a third-party’s requirements for this application and use case; see link to:

black-forest-labs/FLUX.2-klein-4B Model Card
Terms of use
GOVERNING TERMS: The trial service is governed by the NVIDIA API Trial Terms of Service. The Flux.2-klein-4B model is available at https://huggingface.co/black-forest-labs/FLUX.2-klein-4B. Use of the NVIDIA Cosmos-1.0 Guardrail is governed by the NVIDIA Open Model License Agreement. ADDITIONAL INFORMATION: Llama 2 Community License Agreement, Apache License, Version 2.0.

Deployment Geography:
Global

Use Case:
Creators and developers can generate high-quality images from text prompts with low latency for interactive and production workflows.
Image editing and multi-reference editing tasks such as inpainting, style transfer, and object manipulation.
Release Date:
build.nvidia.com March 12, 2025 via https://build.nvidia.com/black-forest-labs/flux_2-klein_4b
HuggingFace January 15, 2026 via https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
References
Flux.2-Klein blog post
Model Architecture:
Architecture Type: Transformer and Convolutional Neural Network (CNN)
Network Architecture: Diffusion Transformer

Number of Model Parameters:
Component	Parameter Count
Qwen3ForCausalLM	~4B
Diffusion Transformer	~4B
Total	~8B
Input:
Input Type(s):
[Text, Image]

Input Format(s):
Text: String
Image: Common formats (e.g., png, jpg, jpeg) for editing tasks.
Input Parameters:
Text: One-Dimensional (1D), sequence of tokens.
Image: Two-Dimensional (2D), spatial pixels, dynamic resolutions. Other Properties Related to Input: Steps, Output Image Size, and Seed
Output:
Output Type(s):
[Image]

Output Format:
Raster image formats (e.g., png, jpg, jpeg) via VAE decoding.

Output Parameters:
Two-Dimensional (2D)

Other Properties Related to Output:
Supported resolutions 672x1568, 688x1504, 720x1456, 752x1392, 800x1328, 832x1248, 880x1184, 944x1104, 1024x1024, 1104x944, 1184x880, 1248x832, 1328x800, 1392x752, 1456x720, 1504x688, 1568x672

Our AI models are designed and/or optimized to run on NVIDIA GPU-accelerated systems. By leveraging NVIDIA’s hardware (e.g. GPU cores) and software frameworks (e.g., CUDA libraries), the model achieves faster training and inference times compared to CPU-only solutions.

Software Integration:
Runtime Engines:

SGlang Diffusion
Supported Hardware Microarchitecture Compatibility:

NVIDIA Blackwell
NVIDIA Hopper
NVIDIA Lovelace
Supported Operating Systems:

Linux
Windows Subsystem for Linux
The integration of foundation and fine-tuned models into AI systems requires additional testing using use-case-specific data to ensure safe and effective deployment. Following the V-model methodology, iterative testing and validation at both unit and system levels are essential to mitigate risks, meet technical and functional requirements, and ensure compliance with safety and ethical standards before deployment.

Model Version(s):
FLUX.2-Klein-4B
Training, Testing, and Evaluation Datasets:
Training, Testing, and Evaluation Datasets:
Dataset Overview:
Total Size: Undisclosed
Training Dataset:
Link: Undisclosed
Data Modality: [Image, Text]
Image Training Data Size: Undisclosed
Text Training Data Size: Undisclosed
Data Collection Method by dataset: Undisclosed
Labeling Method by dataset: Undisclosed
Properties:
Quantity: Undisclosed.
Descriptions: Undisclosed.
Sensors: Undisclosed.
Testing Dataset:
Link: Undisclosed
Data Modality: [Image, Text]
Image Training Data Size: Undisclosed
Text Training Data Size: Undisclosed
Data Collection Method by dataset: Undisclosed
Labeling Method by dataset: Undisclosed
Properties:
Quantity: Undisclosed.
Descriptions: Undisclosed.
Sensors: Undisclosed.
Evaluation Dataset:
Link: Undisclosed
Data Modality: [Image, Text]
Image Training Data Size: Undisclosed
Text Training Data Size: Undisclosed
Data Collection Method by dataset: Undisclosed
Labeling Method by dataset: Undisclosed
Properties:
Quantity: Undisclosed.
Descriptions: Undisclosed.
Sensors: Undisclosed.
Key Considerations:
This model can generate synthetic images and may produce content that is inaccurate, offensive, or otherwise inappropriate. Users should implement robust safety guardrails — including content filtering, abuse monitoring, and access controls— to reduce the risk of harmful outputs. Users are responsible for ensuring that their use of the model complies with all applicable laws and regulations, and for regularly reviewing and updating their guardrails as risks evolve.

For more information about the implementation of Cosmos pre and post guardrails to improve model safety, please see the Cosmos-1.0 Guardrail Model.

For more information about Black Forest Labs' pre-training and post-training mitigations to improve model safety, please visit the Responsible AI Development section at this link.

Inference:
Engine: SGLang Diffusion
Test Hardware: H100

Ethical Considerations:
NVIDIA believes Trustworthy AI is a shared responsibility and we have established policies and practices to enable development for a wide array of AI applications. When downloaded or used in accordance with our terms of service, developers should work with their internal developer team to ensure these software components meet requirements for the relevant industry and use case and address unforeseen product misuse.

Please make sure you have proper rights and permissions for all input image and video content; if image or video includes people, personal health information, or intellectual property, the image or video generated will not blur or maintain proportions of image subjects included.

Users are responsible for model inputs and outputs. Users are responsible for ensuring safe integration of this model, including implementing guardrails as well as other safety mechanisms, prior to deployment.

Please report security vulnerabilities or NVIDIA AI Concerns here.

Get Help
Getting started with the NIM
Deploying and integrating the NIM is straightforward thanks to our industry standard APIs. Visit the Visual Generative AI NIM page for release documentation, deployment guides and more.

Enterprise Support
Get access to knowledge base articles and support cases or submit a ticket.