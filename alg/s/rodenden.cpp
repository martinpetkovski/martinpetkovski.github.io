#include <iostream>
#include <cmath>
using namespace std;
 
int main()
{
    int n;
    cin >> n;
 
    int nSixNine = 0;
    int digits[10] = {};
    while (n != 0)
    {
        int digit = n % 10;
        n /= 10;
 
        digits[digit]++;
    }
 
    int avgDigit = ceil((digits[6] + digits[9]) / 2.0f);
    digits[6] = avgDigit;
    digits[9] = avgDigit;
 
    int max = 0;
    for (int i = 0; i < 10; i++)
    {
        if (digits[i] > max)
        {
            max = digits[i];
        }
    }
 
    cout << max;
 
    return 0;
}