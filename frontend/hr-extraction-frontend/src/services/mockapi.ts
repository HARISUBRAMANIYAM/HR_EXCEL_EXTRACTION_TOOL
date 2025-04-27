// Create a dummy data generator function for the RemittanceDashboard component
export const generateDummyRemittanceData = (year = new Date().getFullYear()) => {
    // Generate monthly labels
    const labels = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    // Generate random PF and ESI amounts for each month (more realistic patterns)
    const pfAmounts = labels.map((_, i) => {
      // Add some seasonal variation and general upward trend
      const baseAmount = 150000 + (i * 5000) + Math.random() * 50000;
      // Add seasonal factor (higher in March, June, September, December)
      const seasonalFactor = (i + 1) % 3 === 0 ? 1.2 : 1;
      return Math.round(baseAmount * seasonalFactor);
    });
    
    const esiAmounts = labels.map((_, i) => {
      // ESI is typically lower than PF but follows similar patterns
      const baseAmount = 75000 + (i * 2500) + Math.random() * 25000;
      const seasonalFactor = (i + 1) % 3 === 0 ? 1.15 : 1;
      return Math.round(baseAmount * seasonalFactor);
    });
    
    // Generate submission points (day of month) for PF and ESI
    // PF submissions typically due by 15th of next month
    // ESI submissions typically due by 15th of next month
    const pfSubmissionPoints = labels.map((month, i) => {
      // Most submissions are on time (before 15th), some are late
      const isLate = Math.random() < 0.2;
      const submissionDay = isLate ? 
        Math.floor(15 + Math.random() * 10) : 
        Math.floor(5 + Math.random() * 10);
      
      return [{
        x: i + 1, // Month number
        y: submissionDay, // Day of submission
        r: 5 // Radius for scatter plot
      }];
    });
    
    const esiSubmissionPoints = labels.map((month, i) => {
      // Similar pattern but with different randomization
      const isLate = Math.random() < 0.15;
      const submissionDay = isLate ? 
        Math.floor(15 + Math.random() * 8) : 
        Math.floor(7 + Math.random() * 8);
      
      return [{
        x: i + 1, // Month number
        y: submissionDay, // Day of submission
        r: 5 // Radius for scatter plot
      }];
    });
    
    // Generate delayed submission data
    const pfDelayedSubmissions = pfSubmissionPoints
      .map((points, i) => {
        if (points[0].y > 15) {
          return [{
            delay_days: points[0].y - 15,
            amount: pfAmounts[i]
          }];
        }
        return [];
      });
    
    const esiDelayedSubmissions = esiSubmissionPoints
      .map((points, i) => {
        if (points[0].y > 15) {
          return [{
            delay_days: points[0].y - 15,
            amount: esiAmounts[i]
          }];
        }
        return [];
      });
    
    // Calculate summary statistics
    const totalPF = pfAmounts.reduce((sum, amount) => sum + amount, 0);
    const totalESI = esiAmounts.reduce((sum, amount) => sum + amount, 0);
    
    const pfSubmissionsCount = pfSubmissionPoints.flat().length;
    const esiSubmissionsCount = esiSubmissionPoints.flat().length;
    
    const delayedPFCount = pfDelayedSubmissions.flat().length;
    const delayedESICount = esiDelayedSubmissions.flat().length;
    
    const onTimeRate = 1 - ((delayedPFCount + delayedESICount) / (pfSubmissionsCount + esiSubmissionsCount));
    
    // Return the complete data structure that matches your interface
    return {
      monthly_amounts: {
        labels: labels,
        datasets: {
          PF: pfAmounts,
          ESI: esiAmounts
        }
      },
      pf_submissions: {
        labels: labels,
        points: pfSubmissionPoints
      },
      esi_submissions: {
        labels: labels,
        points: esiSubmissionPoints 
      },
      delayed_submissions: {
        labels: labels,
        datasets: {
          PF: pfDelayedSubmissions,
          ESI: esiDelayedSubmissions
        }
      },
      summary_stats: {
        total_pf: totalPF,
        total_esi: totalESI,
        pf_submissions: pfSubmissionsCount,
        esi_submissions: esiSubmissionsCount,
        on_time_rate: onTimeRate,
        avg_pf: Math.round(totalPF / pfSubmissionsCount),
        avg_esi: Math.round(totalESI / esiSubmissionsCount)
      },
      year: year
    };
  };
  
  // Example API mock for the remittance dashboard
export const mockRemittanceAPI = {
    get: (endpoint:any, options = {}) => {
      if (endpoint === "/dashboard/remittance_stats_viz") {
        const { year = new Date().getFullYear() } = options?.params || {};
        return Promise.resolve({ data: generateDummyRemittanceData(year) });
      }
      
      if (endpoint === "/uploads/by-year-days/") {
        const { year = new Date().getFullYear() } = options?.params || {};
        const dummyData = generateDummyRemittanceData(year);
        
        // Transform the data to match the expected format for SubmissionTimeline
        const esi = dummyData.esi_submissions.points.map((points, i) => ({
          month: dummyData.monthly_amounts.labels[i],
          day: points[0].y.toString()
        }));
        
        const pf = dummyData.pf_submissions.points.map((points, i) => ({
          month: dummyData.monthly_amounts.labels[i],
          day: points[0].y.toString()
        }));
        
        return Promise.resolve({ data: { esi, pf } });
      }
      
      return Promise.reject(new Error("Unknown endpoint"));
    }
  }