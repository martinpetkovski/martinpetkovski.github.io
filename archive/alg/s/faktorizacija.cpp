#include <iostream>
using namespace std;
 
int main()
{
    int n;
    cin >> n;
 
    bool prv = true;
 
    for (int i=2; i<=n; i++)
    {
        if (n%i == 0)
        {
            int stepen = 0;
 
            while (n%i == 0)
            {
                n /= i;
                stepen++;
            }
 
            if (prv)
            {
                cout << "(" << i << "^" << stepen << ")";
 
                prv = false;
            }
            else
            {
                cout << "*(" << i << "^" << stepen << ")";
            }
        }
    }
 
    return 0;
}