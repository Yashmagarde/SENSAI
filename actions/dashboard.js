// "use server";

// import { db } from "@/lib/prisma";
// import { auth } from "@clerk/nextjs/server";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// export const generateAIInsights = async (industry) => {
//   const prompt = `
//           Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
//           {
//             "salaryRanges": [
//               { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
//             ],
//             "growthRate": number,
//             "demandLevel": "High" | "Medium" | "Low",
//             "topSkills": ["skill1", "skill2"],
//             "marketOutlook": "Positive" | "Neutral" | "Negative",
//             "keyTrends": ["trend1", "trend2"],
//             "recommendedSkills": ["skill1", "skill2"]
//           }
          
//           IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
//           Include at least 5 common roles for salary ranges.
//           Growth rate should be a percentage.
//           Include at least 5 skills and trends.
//         `;

//   const result = await model.generateContent(prompt);
//   const response = result.response;
//   const text = response.text();
//   const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

//   return JSON.parse(cleanedText);
// };

// export async function getIndustryInsights() {
//   const { userId } = await auth();
//   if (!userId) throw new Error("Unauthorized");

//   const user = await db.user.findUnique({
//     where: { clerkUserId: userId },
//     include: {
//       industryInsight: true,
//     },
//   });

//   if (!user) throw new Error("User not found");

//   // If no insights exist, generate them
//   if (!user.industryInsight) {
//     const insights = await generateAIInsights(user.industry);

//     const industryInsight = await db.industryInsight.create({
//       data: {
//         industry: user.industry,
//         ...insights,
//         nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//       },
//     });

//     return industryInsight;
//   }

//   return user.industryInsight;
// }


"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
    {
      "salaryRanges": [
        { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
      ],
      "growthRate": number,
      // CHANGE 1: Ask for uppercase Enum values
      "demandLevel": "HIGH" | "MEDIUM" | "LOW", 
      "topSkills": ["skill1", "skill2"],
      // CHANGE 2: Ask for uppercase Enum values here too (if this is also an Enum)
      "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE", 
      "keyTrends": ["trend1", "trend2"],
      "recommendedSkills": ["skill1", "skill2"]
    }
    
    IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
    Include at least 5 common roles for salary ranges.
    Growth rate should be a percentage.
    Include at least 5 skills and trends.
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json", // 1. FORCE JSON MODE
    },
  });

  const response = result.response;
  const text = response.text();

  // 2. CLEANUP (Still good to keep as a backup)
  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("JSON Parse Error. AI Output:", text); // 3. Log the actual bad output for debugging
    throw new Error("Failed to parse AI industry insights");
  }
};

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  if (!user.industryInsight) {
    const insights = await generateAIInsights(user.industry);

    // 4. ENSURE PRISMA SCHEMA MATCHES THESE FIELDS
    const industryInsight = await db.industryInsight.create({
      data: {
        industry: user.industry,
        ...insights, 
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return industryInsight;
  }

  return user.industryInsight;
}