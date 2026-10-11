// Age guide for grown-ups: research-based typical age ranges per level.
// Numbers in [n] refer to AGE_REFS (1-based). Every reference was checked to exist; see README.

export const AGE_INTRO =
  'The ages below are rough typical ranges drawn from research and early-learning frameworks. They are not milestones or tests. Children vary widely: in the words of the NAEYC/NCTM early-maths statement, “developmental variation is the norm, not the exception” [1]. Finding a game hard does not mean a child is behind, and these games are not a screening or diagnostic tool. If you are worried about your child’s development in general, talk to your paediatrician. Several games go beyond what most young children can do alone; treat those as puzzles to explore together.';

export const AGE_LEVELS = [
  {
    n: 1,
    band: 'about 3½–5 years',
    text: 'Many 3-year-olds count up to four objects and sort and compare small groups [1]. Using matching or counting to decide whether one group has more, fewer or the same is expected in kindergarten, at about 5–6 [2]. By about 5, children can usually put familiar daily events in order, even backwards [4].',
    games: [
      [
        'Number Path Race',
        'Playing straight, numbered board games improved young children’s number knowledge [23], and counting on from the token’s square helped more than counting from 1 [24]; in a Hong Kong trial, parents playing such games with their child also helped [25].',
      ],
      [
        'Quick Peek',
        'Seeing small amounts at a glance and using five- and ten-frames are named in Singapore’s preschool numeracy guide [29] and are part of a well-tested preschool curriculum [26]; Swedish studies teach 5 and 10 as units [27, 28].',
      ],
      [
        'Odd One Out',
        'Sorting by one feature comes early [1]. Switching features so that a different item becomes the odd one is harder, so expect the later rounds to need help.',
      ],
    ],
  },
  {
    n: 2,
    band: 'about 4½–6 years, with several stretch games',
    text: 'Three-year-olds copy simple repeating patterns [1], and pattern skill between 4 and 6 is linked to later maths [5].',
    games: [
      [
        'Hidden Beads',
        'Knowing the parts that make a whole up to 10 is a goal in Singapore’s guide [29]; China’s guidelines expect “2 and 3 together make 5” at about 4–5 [30]; a Swedish preschool study taught this part–whole idea [27].',
      ],
      [
        'What Does Teddy See?',
        'Spatial training improves maths in a meta-analysis (effect about 0.28) [32]; position words appear in Finland’s early-years curriculum [31] and simple maps in China’s guidelines for 5–6-year-olds [30].',
      ],
      [
        'Fold, Cut, Unfold',
        'Picturing a fold in the mind appeared at about 5½ years, with large differences between children [6].',
      ],
      [
        'The Missing Shape',
        'In similar matrix puzzles, correct answers rose from about 20% at age 6 to 78% at age 8 [7]. A stretch.',
      ],
      [
        'Mirror Pegboard',
        'Lines of symmetry are formally taught at about 9–10 (US Grade 4) [8]. A stretch: copying a mirror shape with help is the aim.',
      ],
      [
        'Rope Rings',
        'Sorting into two groups fits this age [1, 2]. The “both” and “neither” zones draw on class logic that develops through the early school years [9].',
      ],
      ['The Ant on the Band', 'We found no age research on twisted (Möbius) bands. Explore it together.'],
    ],
  },
  {
    n: 3,
    band: 'about 5–6½ years, with stretch games',
    text: 'Putting shapes together to make bigger shapes is a kindergarten skill, at about 5–6 [3]. On Piaget’s “same amount after pouring?” tasks [10], many 4- to 6-year-olds succeed when the change looks accidental; how the question is asked matters a lot [11].',
    games: [
      [
        'Equal Towers & Bars',
        'Moving from objects to pictures to symbols is named in Singapore’s guide [29] and supported by a review of “concreteness fading” [33]. The bar rounds borrow the bar model, studied mainly with children of 8 and older [34], so treat them as a stretch.',
      ],
      [
        'Tower to the Mark',
        'Measuring and comparing appear in Sweden’s and Finland’s early-years curricula [35, 31], and measurement is part of a well-tested preschool curriculum [26].',
      ],
      [
        'Dice Race',
        'Babies already sense likely and unlikely outcomes [12], but school-age children still make errors on chance problems [13]. We found no age norms for two-dice totals, so treat it as a stretch.',
      ],
      [
        'Which Room Is Larger?',
        'Children in school grades 1–4 were still working out how unit squares cover a rectangle [14].',
      ],
      ['Squares That Grow', 'Research on growing patterns mostly involves children of about 8 [15]. A stretch.'],
    ],
  },
  {
    n: 4,
    band: 'about 5½–7 years, with stretch games',
    text: 'Children aged 4½–6½ got better at ordering picture-stories after programming robots [16]. Splitting small numbers into pairs (5 = 2 + 3 = 4 + 1) is a kindergarten skill [17].',
    games: [
      [
        'Tower of Hanoi and Builder Team',
        '4- to 6-year-olds can plan short versions, and older children do better [18]. The age gap widens as puzzles get longer [19], so the 4-disc rounds are a stretch.',
      ],
      [
        'Make It Twice as Big',
        'By about 6, children judge proportions of continuous amounts, but proportions with countable units such as grid squares stay hard until 10–12 [20]. A stretch.',
      ],
      ['Chain of Blocks', 'Keeping several features in mind at once develops through the early school years [9].'],
    ],
  },
  {
    n: 5,
    band: 'about 7 years and up; best done together',
    text: 'These are classic puzzles for older children and adults.',
    games: [
      [
        'Necklace Makers',
        'Children began listing combinations systematically at about 7 [21]. Spotting necklaces that are the same when turned or flipped is harder still.',
      ],
      [
        'All the Labels Are Wrong',
        '3- to 5-year-olds make simple “not here, so it must be there” inferences [22]. This puzzle chains several of them.',
      ],
      [
        'Wolf, Goat and Cabbage and Shoes in the Dark',
        'We found no age research on these puzzles. Enjoy them together, not as something a child “should” solve.',
      ],
    ],
  },
];

export const AGE_CAVEAT =
  'How these ranges were made: each band is our synthesis across the studies and frameworks below, not a figure from any single study. Most of the evidence comes from US and UK children, and the Common Core and NAEYC anchors are US frameworks.';

export const AGE_REFS = [
  'National Association for the Education of Young Children & National Council of Teachers of Mathematics. (2002, updated 2010). Early childhood mathematics: Promoting good beginnings [Joint position statement]. https://www.naeyc.org/positionstatements/mathematics',
  'National Governors Association Center for Best Practices & Council of Chief State School Officers. (2010). Common Core State Standards for Mathematics: Kindergarten, Counting & Cardinality (K.CC.4–6) and Measurement & Data (K.MD.3). https://www.thecorestandards.org/Math/Content/K/CC/',
  'National Governors Association Center for Best Practices & Council of Chief State School Officers. (2010). Common Core State Standards for Mathematics: Kindergarten, Geometry (K.G.6). https://www.thecorestandards.org/Math/Content/K/G/',
  'Friedman, W. J. (1990). Children’s representations of the pattern of daily activities. Child Development, 61(5), 1399–1412. https://doi.org/10.1111/j.1467-8624.1990.tb02870.x',
  'Zippert, E. L., Douglas, A.-A., & Rittle-Johnson, B. (2020). Finding patterns in objects and numbers: Repeating patterning in pre-K predicts kindergarten mathematics knowledge. Journal of Experimental Child Psychology, 200, 104965. https://doi.org/10.1016/j.jecp.2020.104965',
  'Harris, J., Newcombe, N. S., & Hirsh-Pasek, K. (2013). A new twist on studying the development of dynamic spatial transformations: Mental paper folding in young children. Mind, Brain, and Education, 7(1), 49–55. https://doi.org/10.1111/mbe.12007',
  'Siegler, R. S., & Svetina, M. (2002). A microgenetic/cross-sectional study of matrix completion: Comparing short-term and long-term change. Child Development, 73(3), 793–809. https://doi.org/10.1111/1467-8624.00439',
  'National Governors Association Center for Best Practices & Council of Chief State School Officers. (2010). Common Core State Standards for Mathematics: Grade 4, Geometry (4.G.A.3). https://www.thecorestandards.org/Math/Content/4/G/',
  'Inhelder, B., & Piaget, J. (1964). The early growth of logic in the child: Classification and seriation. Routledge & Kegan Paul.',
  'Piaget, J. (1952). The child’s conception of number. Routledge & Kegan Paul.',
  'McGarrigle, J., & Donaldson, M. (1974). Conservation accidents. Cognition, 3(4), 341–350. https://doi.org/10.1016/0010-0277(74)90003-1',
  'Denison, S., & Xu, F. (2014). The origins of probabilistic inference in human infants. Cognition, 130(3), 335–347. https://doi.org/10.1016/j.cognition.2013.12.001',
  'Fischbein, E., Nello, M. S., & Marino, M. S. (1991). Factors affecting probabilistic judgements in children and adolescents. Educational Studies in Mathematics, 22, 523–549. https://doi.org/10.1007/BF00312714',
  'Outhred, L. N., & Mitchelmore, M. C. (2000). Young children’s intuitive understanding of rectangular area measurement. Journal for Research in Mathematics Education, 31(2), 144–167. https://doi.org/10.2307/749749',
  'Warren, E., & Cooper, T. (2008). Generalising the pattern rule for visual growth patterns: Actions that support 8 year olds’ thinking. Educational Studies in Mathematics, 67(2), 171–185. https://doi.org/10.1007/s10649-007-9092-2',
  'Kazakoff, E. R., & Bers, M. U. (2014). Put your robot in, put your robot out: Sequencing through programming robots in early childhood. Journal of Educational Computing Research, 50(4), 553–573. https://doi.org/10.2190/EC.50.4.f',
  'National Governors Association Center for Best Practices & Council of Chief State School Officers. (2010). Common Core State Standards for Mathematics: Kindergarten, Operations & Algebraic Thinking (K.OA.3). https://www.thecorestandards.org/Math/Content/K/OA/',
  'Klahr, D., & Robinson, M. (1981). Formal assessment of problem-solving and planning processes in preschool children. Cognitive Psychology, 13(1), 113–148. https://doi.org/10.1016/0010-0285(81)90006-2',
  'Welsh, M. C. (1991). Rule-guided behavior and self-monitoring on the Tower of Hanoi disk-transfer task. Cognitive Development, 6(1), 59–76. https://doi.org/10.1016/0885-2014(91)90006-Y',
  'Boyer, T. W., Levine, S. C., & Huttenlocher, J. (2008). Development of proportional reasoning: Where young children go wrong. Developmental Psychology, 44(5), 1478–1490. https://doi.org/10.1037/a0013110',
  'English, L. D. (1991). Young children’s combinatoric strategies. Educational Studies in Mathematics, 22, 451–474. https://doi.org/10.1007/BF00367908',
  'Mody, S., & Carey, S. (2016). The emergence of reasoning by the disjunctive syllogism in early childhood. Cognition, 154, 40–48. https://doi.org/10.1016/j.cognition.2016.05.012',
  'Ramani, G. B., & Siegler, R. S. (2008). Promoting broad and stable improvements in low-income children’s numerical knowledge through playing number board games. Child Development, 79(2), 375–394. https://doi.org/10.1111/j.1467-8624.2007.01131.x',
  'Laski, E. V., & Siegler, R. S. (2014). Learning from number board games: You learn what you encode. Developmental Psychology, 50(3), 853–864. https://doi.org/10.1037/a0034321',
  'Cheung, S. K., & McBride, C. (2017). Effectiveness of parent–child number board game playing in promoting Chinese kindergarteners’ numeracy skills and mathematics interest. Early Education and Development, 28(5), 572–589. https://doi.org/10.1080/10409289.2016.1258932',
  'Clements, D. H., Sarama, J., Spitler, M. E., Lange, A. A., & Wolfe, C. B. (2011). Mathematics learned by young children in an intervention based on learning trajectories: A large-scale cluster randomized trial. Journal for Research in Mathematics Education, 42(2), 127–166. https://doi.org/10.5951/jresematheduc.42.2.0127',
  'Kullberg, A., Björklund, C., Brkovic, I., & Runesson Kempe, U. (2020). Effects of learning addition and subtraction in preschool by making the first ten numbers and their relations visible with finger patterns. Educational Studies in Mathematics, 103(2), 157–172. https://doi.org/10.1007/s10649-019-09927-1',
  'Björklund, C., Marton, F., & Kullberg, A. (2021). What is to be learnt? Critical aspects of elementary arithmetic skills. Educational Studies in Mathematics, 107(2), 261–284. https://doi.org/10.1007/s10649-021-10045-0',
  'Ministry of Education, Singapore. (2023). Nurturing Early Learners: Educators’ guide: Numeracy (ISBN 978-981-18-7429-1). https://www.nel.moe.edu.sg/qql/slot/u143/2022/EG2022/Nurturing%20Early%20Learners%202022%20Educators%20Guide%20Numeracy.pdf',
  'Ministry of Education of the People’s Republic of China. (2012). Early learning and development guidelines for children aged 3–6 [3-6岁儿童学习与发展指南] (教基二〔2012〕4号). http://www.moe.gov.cn/srcsite/A06/s3327/201210/t20121009_143254.html',
  'Finnish National Agency for Education. (2022). National core curriculum for early childhood education and care (OPH-700-2022). https://www.oph.fi/sites/default/files/documents/Varhaiskasvatussuunnitelman%20perusteet%202022_EN_final_23%20.pdf',
  'Hawes, Z. C. K., Gilligan-Lee, K. A., & Mix, K. S. (2022). Effects of spatial training on mathematics performance: A meta-analysis. Developmental Psychology, 58(1), 112–137. https://doi.org/10.1037/dev0001281',
  'Fyfe, E. R., McNeil, N. M., Son, J. Y., & Goldstone, R. L. (2014). Concreteness fading in mathematics and science instruction: A systematic review. Educational Psychology Review, 26(1), 9–25. https://doi.org/10.1007/s10648-014-9249-3',
  'Kaur, B. (2019). The why, what and how of the ‘Model’ method: A tool for representing and visualising relationships when solving whole number arithmetic word problems. ZDM Mathematics Education, 51(1), 151–168. https://doi.org/10.1007/s11858-018-1000-y',
  'Skolverket. (2018). Läroplan för förskolan, Lpfö 18. Stockholm: Skolverket (maths goals as quoted in Skolverket’s Lärportalen module Matematik – Förskola). https://larportalen.skolverket.se/api/resource/P03WCPLAR131507',
];
